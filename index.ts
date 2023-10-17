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
const publicSubnets:aws.ec2.Subnet[] = []; 


const vpcCidrBlock = baseVpcCidrBlock;
const subnetMask = '255.255.240.0';

const myIpAddress = "73.142.182.118"; 


const numberOfSubnets = 6;

// const complete_availabilityZones = pulumi.output(aws.getAvailabilityZones({
//   state: "available"
// }));

// const availabilityZones = complete_availabilityZones.apply(az => az.names.slice(0, 3));

// Function to calculate the new subnet mask
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


// Separate the generated CIDR blocks into public and private subnets
const publicSubnetCidrBlocks = subnetCidrBlocks.slice(0, numPublicSubnets);
const privateSubnetCidrBlocks = subnetCidrBlocks.slice(numPrivateSubnets, numberOfSubnets);// Assuming 3 public and 3 private subnets

// const vpcCidrParts = vpcCidrBlock.split(".");
// const vpcNetwork = vpcCidrParts[0] + "." + vpcCidrParts[1];

// for (let i = 1; i <= 3; i++) {
//   const publicSubnetCIDR = vpcNetwork+`.${i}.0`+"/24";
//   const privateSubnetCIDR = vpcNetwork+`.${i+3}.0`+"/24";;
//   publicSubnetCidrBlocks.push(publicSubnetCIDR);
//   privateSubnetCidrBlocks.push(privateSubnetCIDR);
// }


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
          cidrBlock:"0.0.0.0/0",
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
  // console.log(publicSubnets)


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
  });

  

const ec2SecurityGroup = new aws.ec2.SecurityGroup("myEC2SecurityGroup", {
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
          cidrBlocks: ["0.0.0.0/0"],  
      },
      {
          protocol: "tcp",
          fromPort: 443,  
          toPort: 443,
          cidrBlocks: ["0.0.0.0/0"], 
      },
      {
        protocol: "tcp",
        fromPort: 8080,
        toPort : 8080,
        cidrBlocks:["0.0.0.0/0"]
      }
  ],
});

const ec2Ami = aws.ec2.getAmi({
executableUsers:["311572683597"],
mostRecent:true,
filters:[
  {
    name:"name",
    values:["my-ami_*"],
  }
]
})

const ec2Instance = new aws.ec2.Instance("ec2",{
ami:ec2Ami.then(ec2Ami=>ec2Ami.id),
subnetId:publicSubnets[0].id,
vpcSecurityGroupIds:[ec2SecurityGroup.id],
instanceType:instanceType,
keyName: keyPairName,
tags:{
  Name:"MyEc2"
},
ebsBlockDevices:[
  {
    deviceName:"/dev/sda1",
    volumeSize: volumeSize,
    volumeType: volumeType
  }
],
disableApiTermination:false
});
console.log(ec2Instance);
});

export const vpcId = vpc.id;
export const gateWayId = internetGateway.id;
// export const ec2Id = ec2Instance.id;