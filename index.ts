import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as subnetCalculator from 'ip-subnet-calculator';
const config = new pulumi.Config();



const vpcName = config.require("vpcName");
const igwName = config.require("igwName");
const privateRouteTableName = config.require("privateRouteTable");
const publicRouteTableName = config.require("publicRouteTable");
const privateSubnetName = config.require("privateSubnet");
const publicSubnetName = config.require("publicSubnet");
const publicAssociationName = config.require("publicSubnetAssociation");
const privateAssociationName = config.require("privateSubnetAssociation");
const keyPairName = config.require("keyPair");
const baseVpcCidrBlock = config.require("vpcCidrBlock")
const instanceType = config.require("instanceType");
const volumeSize:number = config.requireNumber("volumeSize");
const volumeType = config.require("volumeType");
const allIp = config.require("allIp");
const users = config.require("users");
const myIp = config.require("myIp");
const noSubnets = config.requireNumber("noSubnets");
const publicSubnets:aws.ec2.Subnet[] = []; 
const privateSubnets:aws.ec2.Subnet[] = []; 
const dbName = config.require('dbName');
const dbPassword = config.require("dbPassword");
const dbPort = config.require('dbPort');
const dbUsername = config.require('dbUsername');
const rdsInstanceType = config.require('rdsInstanceType');
const policyArn = config.require('policyArn');
const zoneName = config.require('zoneName');

// let zones:aws.route53.RecordArgs;

const vpcCidrBlock = baseVpcCidrBlock;
const subnetMask = '255.255.240.0';

const myIpAddress = myIp; 


const numberOfSubnets = noSubnets;


function calculateNewSubnetMask(vpcMask: number, numSubnets: number): number {
  const bitsNeeded = Math.ceil(Math.log2(numSubnets));
  const newSubnetMask = vpcMask + bitsNeeded;
  return newSubnetMask;
}

function ipToInt(ip: string): number {
  const octets = ip.split('.').map(Number);
  return (octets[0] << 24) + (octets[1] << 16) + (octets[2] << 8) + octets[3];
}

function intToIp(int: number): string {
  return [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join('.');
}

function generateSubnetCidrBlocks(baseCidrBlock: string, numSubnets: number): string[] {
  const [baseIp, vpcMask] = baseCidrBlock.split('/');
  const newSubnetMask = calculateNewSubnetMask(Number(vpcMask), numSubnets);
  const subnetSize = Math.pow(2, 32 - newSubnetMask);
  const subnetCidrBlocks = [];
  for (let i = 0; i < numSubnets; i++) {
      const subnetIpInt = ipToInt(baseIp) + i * subnetSize;
      const subnetIp = intToIp(subnetIpInt);
      subnetCidrBlocks.push(`${subnetIp}/${newSubnetMask}`);
  }
  return subnetCidrBlocks;
}



const numPublicSubnets = numberOfSubnets / 2;
const numPrivateSubnets = numberOfSubnets / 2;

const subnetCidrBlocks = generateSubnetCidrBlocks(vpcCidrBlock, numberOfSubnets);


const publicSubnetCidrBlocks = subnetCidrBlocks.slice(0, numPublicSubnets);
const privateSubnetCidrBlocks = subnetCidrBlocks.slice(numPrivateSubnets, numberOfSubnets);


const vpc = new aws.ec2.Vpc(vpcName, {
    cidrBlock: vpcCidrBlock,
    tags:{
      Name:vpcName
    }

  });

  const internetGateway = new aws.ec2.InternetGateway(igwName, {
    vpcId: vpc.id,
    tags:{
      Name:igwName
    }
  
  });

aws.getAvailabilityZones({ state: "available" }).then((availabilityZones) => {
  const publicRouteTable = new aws.ec2.RouteTable(publicRouteTableName, {
      vpcId: vpc.id,
      tags: {
          Name: publicRouteTableName
      },
      routes:[
        {
          cidrBlock:allIp,
          gatewayId:internetGateway.id

        }
      ]
  });

    availabilityZones.names.slice(0, 3).forEach((az, index) => {
        const publicSubnet = new aws.ec2.Subnet(publicSubnetName+`${index}`, {
            vpcId: vpc.id,
            cidrBlock: publicSubnetCidrBlocks[index],
            availabilityZone: az,
            mapPublicIpOnLaunch: true,
            tags: {
                Name: publicSubnetName+`${index}`
            }
        });
      const subnetAssociation = new aws.ec2.RouteTableAssociation(publicAssociationName+`${index}`, {
          subnetId: publicSubnet.id,
          routeTableId: publicRouteTable.id,
      });
      publicSubnets.push(publicSubnet);

  });


  const privateRouteTable = new aws.ec2.RouteTable(privateRouteTableName, {
    vpcId: vpc.id,
    tags: {
        Name: privateRouteTableName
    }
});


  availabilityZones.names.slice(0, 3).forEach((az, index) => {
      const privateSubnet = new aws.ec2.Subnet(privateSubnetName+`${index}`, {
          vpcId: vpc.id,
          cidrBlock: privateSubnetCidrBlocks[index],
          availabilityZone: az,
          tags: {
              Name: privateSubnetName+`${index}`
          }
      });
      const subnetAssociation = new aws.ec2.RouteTableAssociation(privateAssociationName+`${index}`, {
        subnetId: privateSubnet.id,
        routeTableId: privateRouteTable.id,
    });
    privateSubnets.push(privateSubnet);
  });

  const privateSubnetGroup = new aws.rds.SubnetGroup("my-rds-private-subnet-group", {
    subnetIds: privateSubnets.map(subnet => subnet.id),
  });


  

const ec2SecurityGroup = new aws.ec2.SecurityGroup("applicationSecurityGroup", {
  description: "My EC2 Instance Security Group",
  vpcId:vpc.id,
  ingress: [
      {
          protocol: "tcp",
          fromPort: 22, 
          toPort: 22,
          cidrBlocks: [myIpAddress + "/32"],  
      },
      {
          protocol: "tcp",
          fromPort: 80,  
          toPort: 80,
          cidrBlocks: [allIp],  
      },
      {
          protocol: "tcp",
          fromPort: 443,  
          toPort: 443,
          cidrBlocks: [allIp], 
      },
      {
        protocol: "tcp",
        fromPort: 8080,
        toPort : 8080,
        cidrBlocks:[allIp]
      }
  ],
  egress:[
    {
      protocol: "-1",
      fromPort: 0,
      toPort:0,
      cidrBlocks:[allIp]
    }
  ]
});

const ec2Ami = aws.ec2.getAmi({
executableUsers:[users],
mostRecent:true,
filters:[
  {
    name:"name",
    values:["my-ami_*"],
  }
]
})



// const 


const dbSecurityGroup = new aws.ec2.SecurityGroup("databaseSecurityGroup", {
  description: "My EC2 Instance Security Group",
  vpcId:vpc.id,
  tags:
  {
    Name:'databaseSecurityGroup'
  }
});

const ingressRule = new aws.ec2.SecurityGroupRule("database-ingress-rule", {
  type: "ingress",
  fromPort: 3306, 
  toPort: 3306, 
  protocol: "tcp",
  sourceSecurityGroupId: ec2SecurityGroup.id, 
  securityGroupId: dbSecurityGroup.id,
});


const rdsParameterGroup = new aws.rds.ParameterGroup("my-rds-parameter-group", {
  family: "mysql8.0", 
  description: "My RDS Parameter Group", 

});

let vpcIdVariable =''; // Declare a variable to store the VPC ID


vpc.id.apply(id=>{
  vpcIdVariable=id
});


const rdsInstance = new aws.rds.Instance("my-rds", {
  allocatedStorage: 20,
  dbName: dbName,
  engine: "mysql",
  engineVersion: "8.0.33", 
  instanceClass: rdsInstanceType,
  parameterGroupName: rdsParameterGroup.name,
  username: dbUsername,
  password: dbPassword, 
  skipFinalSnapshot: true,
  vpcSecurityGroupIds:[dbSecurityGroup.id],
  dbSubnetGroupName:privateSubnetGroup.name  
});

const db_address = rdsInstance.address;

module.exports ={
db_address
}

const role = new aws.iam.Role("myRole", {
  assumeRolePolicy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [{
          Effect: "Allow",
          Principal: {
              Service: "ec2.amazonaws.com"
          },
          Action: "sts:AssumeRole",
      }],
  }),
});

// Attach an AWS managed policy to the role
const rolePolicyAttachment = new aws.iam.RolePolicyAttachment("myRolePolicyAttachment", {
  role: role,
  policyArn: policyArn,
});

const instanceProfile = new aws.iam.InstanceProfile("myInstanceProfile", {
  role: role.name,
});



const ec2Instance = new aws.ec2.Instance("ec2",{
  ami:ec2Ami.then(ec2Ami=>ec2Ami.id),
  subnetId:publicSubnets[0].id,
  vpcSecurityGroupIds:[ec2SecurityGroup.id],
  instanceType:instanceType,
  keyName: keyPairName,
  disableApiTermination: false,
  iamInstanceProfile:instanceProfile,
  userData:pulumi.interpolate`#!/bin/bash
  sudo systemctl stop web-app
  sudo systemctl start web-app
  sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json -s
  /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a start
  cat << EOF > /opt/web-app/.env
  DB_HOST= ${rdsInstance.address}
  DB_PORT=${rdsInstance.port}
  DB_DATABASE=${rdsInstance.dbName}
  DB_USERNAME=${rdsInstance.username}
  DB_PASSWORD=${rdsInstance.password}
  FILE_PATH=./opt/users.csv
  EOF
  `,
  tags:{
    Name:"MyEc2"
  },
  rootBlockDevice:{
    deleteOnTermination:true,
    volumeSize:volumeSize,
    volumeType:volumeType
  },
  },{
    dependsOn:[rdsInstance,rolePolicyAttachment,instanceProfile]
  });


    const zones =  aws.route53.getZone({ name: zoneName }); // Replace "example.com" with your domain name or use listHostedZones() to get all zones.


const zoneId = zones.then( zone =>{
  const zoneId = zone.id
return zoneId})


const aRecord = new aws.route53.Record("ec2Record",{
  zoneId:zoneId,
  name:zoneName,
  type:"A",
  ttl:60,
  records:[ec2Instance.publicIp]
})
});

export const vpcId = vpc.id;
export const gateWayId = internetGateway.id;
