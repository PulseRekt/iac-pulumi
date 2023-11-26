import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as subnetCalculator from 'ip-subnet-calculator';
import { Ipv4 } from "@pulumi/aws/alb";
import { Archive } from "@pulumi/pulumi/asset";
import * as archive from "@pulumi/archive";
import { archiveDirectory } from './archiver';
import * as gcp from "@pulumi/gcp";

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
const sourceDir = '/Users/barathisridhar/Documents/GitHub/serverless/';
const outputFilePath = 'lambda_function_payload.zip';
const snsArn = config.require('snsArn');
// const gcpProject = config.require('gcp:project');

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


  
const ec2Ami = aws.ec2.getAmi({
executableUsers:[users],
mostRecent:true,
filters:[
  {
    name:"name",
    values:["my-ami_*"],
  }
]
});



// const 


const dbSecurityGroup = new aws.ec2.SecurityGroup("databaseSecurityGroup", {
  description: "My EC2 Instance Security Group",
  vpcId:vpc.id,
  tags:
  {
    Name:'databaseSecurityGroup'
  }
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

const lbSecurityGroup = new aws.ec2.SecurityGroup("loadBalancerSecurityGroup",{
  vpcId:vpc.id,
  tags:{
    Name:'loadBalancerSecurityGroup'
  },
  ingress:[
    {
      protocol:'tcp',
      fromPort:80,
      toPort:80,
      cidrBlocks:[allIp]
    },
    {
      protocol:'tcp',
      fromPort:443,
      toPort:443,
      cidrBlocks:[allIp]
    }
  ],
  egress: [{
    fromPort: 0,
    toPort: 0,
    protocol: "-1",
    cidrBlocks: ["0.0.0.0/0"],
}],
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
      // {
      //     protocol: "tcp",
      //     fromPort: 80,  
      //     toPort: 80,
      //     cidrBlocks: [allIp],  
      // },
      // {
      //     protocol: "tcp",
      //     fromPort: 443,  
      //     toPort: 443,
      //     cidrBlocks: [allIp], 
      // },
      {
        protocol: "tcp",
        fromPort: 8080,
        toPort : 8080,
        // cidrBlocks:[allIp]
        securityGroups:[lbSecurityGroup.id]
      }
  ],
  egress:[
    {
      protocol: "-1",
      fromPort: 0,
      toPort:0,
      cidrBlocks:[allIp]
      // securityGroups:[dbSecurityGroup.id,lbSecurityGroup.id]
    }
  ]
});

const ingressRule = new aws.ec2.SecurityGroupRule("database-ingress-rule", {
  type: "ingress",
  fromPort: 3306, 
  toPort: 3306, 
  protocol: "tcp",
  sourceSecurityGroupId: ec2SecurityGroup.id, 
  securityGroupId: dbSecurityGroup.id,
});


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


const rolePolicyAttachment = new aws.iam.RolePolicyAttachment("myRolePolicyAttachment", {
  role: role,
  policyArn: policyArn,
});

const snsPolicy = new aws.iam.RolePolicyAttachment("snsPublishRolePolicyAttachment", {
  role: role,
  policyArn:snsArn
});

const instanceProfile = new aws.iam.InstanceProfile("myInstanceProfile", {
  role: role.name,
});

  const targetGroup = new aws.alb.TargetGroup("targetGroup",{
    port:8080,
    protocol:'HTTP',
    vpcId:vpc.id,
    targetType:'instance',
    healthCheck:{
      enabled:true,
      path:'/healthz',
      protocol:'HTTP',
      port:'8080',
      timeout:10,
      healthyThreshold:2,
      unhealthyThreshold:2,
      matcher:"200",
      interval:15
      
    },
    deregistrationDelay:500
  });


const combinedOutputs = pulumi.all([rdsInstance.address, rdsInstance.port, rdsInstance.dbName, rdsInstance.username, rdsInstance.password,snsTopic.arn]);

const userData = combinedOutputs.apply(([address, port, dbName, username, password,sns_arn]) => {
    // Construct the user data script with actual values
    const script = `#!/bin/bash
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json -s
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a start
sudo systemctl daemon-reload
sudo systemctl start web-app
cat << EOF > /opt/web-app/.env
DB_HOST=${address}
DB_PORT=${port}
DB_DATABASE=${dbName}
DB_USERNAME=${username}
DB_PASSWORD=${password}
SNS_ARN=${sns_arn}
FILE_PATH=./opt/users.csv
EOF
`;
    // Return the Base64 encoded script
    return Buffer.from(script).toString('base64');
});
// console.log(ec2Ami.);
const launchTemplate = new aws.ec2.LaunchTemplate("ec2Template",{
  instanceType:instanceType,
  imageId:ec2Ami.then(ami=>ami.id),
  blockDeviceMappings:[
    {
      deviceName:'/dev/xvda',
      ebs:{
        
        deleteOnTermination:'true',
        volumeSize:volumeSize,
        volumeType:volumeType
      }
    }
  ],
  iamInstanceProfile:{
    arn:instanceProfile.arn
  },
  tags:{
    key:"Name",
    value:"MyEc2"
  },
  keyName:keyPairName,
  vpcSecurityGroupIds:[ec2SecurityGroup.id],
  disableApiTermination:false,
  userData:userData,
},
{
  dependsOn:[rdsInstance,rolePolicyAttachment,instanceProfile,snsTopic]
});

const autoScalingGroup = new aws.autoscaling.Group("autoScalingGroup",{
  // availabilityZones: [],
  vpcZoneIdentifiers:publicSubnets.map(subnet=>subnet.id),
  desiredCapacity:1,
  maxSize:3,
  minSize:1,
  healthCheckGracePeriod:100,
  targetGroupArns:[targetGroup.arn],
  launchTemplate:{
    id:launchTemplate.id
  },
  tags:[
    {
      key:'Name',
      value:'myEc2',
      propagateAtLaunch:true
    }
  ],
  healthCheckType:'EC2'
});

const cpuHighScalingPolicy = new aws.autoscaling.Policy("cpuHigh", {
  autoscalingGroupName: autoScalingGroup.name,
  adjustmentType: "ChangeInCapacity",
  scalingAdjustment: 1,   
  cooldown: 60,          
  metricAggregationType: "Average"
});

const highCpuAlarm = new aws.cloudwatch.MetricAlarm("highCpuAlarm", {
  name: "HighCPUUtilization",
  comparisonOperator: "GreaterThanOrEqualToThreshold",
  evaluationPeriods: 2,
  metricName: "CPUUtilization",
  namespace: "AWS/EC2",
  period: 60,         
  statistic: "Average",
  threshold: 5,         
  alarmActions: [cpuHighScalingPolicy.arn],
  dimensions: {
      AutoScalingGroupName: autoScalingGroup.name
  }
});

const cpuLowScalingPolicy = new aws.autoscaling.Policy("cpuLow", {
  autoscalingGroupName: autoScalingGroup.name,
  adjustmentType: "ChangeInCapacity",
  scalingAdjustment: -1,  
  cooldown: 60,          
  metricAggregationType: "Average"
});

const lowCpuAlarm = new aws.cloudwatch.MetricAlarm("lowCpuAlarm", {
  name: "LowCPUUtilization",
  comparisonOperator: "LessThanOrEqualToThreshold",
  evaluationPeriods: 2,
  metricName: "CPUUtilization",
  namespace: "AWS/EC2",
  period: 120,          
  statistic: "Average",
  threshold: 3,       
  alarmActions: [cpuLowScalingPolicy.arn],
  dimensions: {
      AutoScalingGroupName: autoScalingGroup.name
  }
});

const loadBalancer = new aws.alb.LoadBalancer("loadBalancer",{
  internal:false,
  loadBalancerType:"application",
  securityGroups:[lbSecurityGroup.id],
  subnets:publicSubnets.map(subnet=>subnet.id),
  enableDeletionProtection:false,
  ipAddressType:Ipv4
  });

  const listener = new aws.alb.Listener("listener",{
    loadBalancerArn:loadBalancer.arn,
    port:80,
    defaultActions:[{
      type:'forward',
      targetGroupArn:targetGroup.arn
    }]
  });

    const zones =  aws.route53.getZone({ name: zoneName }); 


const zoneId = zones.then( zone =>{
  const zoneId = zone.id
return zoneId})


const aRecord = new aws.route53.Record("ec2Record",{
  zoneId:zoneId,
  name:zoneName,
  type:"A",
  // ttl:60,
  // records:[ec2Instance.publicIp]
  aliases:[
    {
      name:loadBalancer.dnsName,
      zoneId:loadBalancer.zoneId,
      evaluateTargetHealth:true
    }
  ]
})
});

const snsTopic = new aws.sns.Topic("snsTopic", {deliveryPolicy: `{
  "http": {
    "defaultHealthyRetryPolicy": {
      "minDelayTarget": 20,
      "maxDelayTarget": 20,
      "numRetries": 3,
      "numMaxDelayRetries": 0,
      "numNoDelayRetries": 0,
      "numMinDelayRetries": 0,
      "backoffFunction": "linear"
    },
    "disableSubscriptionOverrides": false,
    "defaultThrottlePolicy": {
      "maxReceivesPerSecond": 1
    }
  }
}
`});

const assumeRole = aws.iam.getPolicyDocument({
  statements: [{
      effect: "Allow",
      principals: [{
          type: "Service",
          identifiers: ["lambda.amazonaws.com"],
      }],
      actions: ["sts:AssumeRole"],
  }],
});
const iamForLambda = new aws.iam.Role("iamForLambda", {assumeRolePolicy: assumeRole.then(assumeRole => assumeRole.json)});



const lambdaExecutionRolePolicyAttachment = new aws.iam.RolePolicyAttachment("lambdaExecutionRolePolicyAttachment", {
  role: iamForLambda.name,
  policyArn: "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
});

const lambdaSESPolicyAttachment = new aws.iam.RolePolicyAttachment("lambdaSESPolicyAttachment", {
  role: iamForLambda.name,
  policyArn: "arn:aws:iam::aws:policy/AmazonSESFullAccess",
});

const dynamoDBPolicyAttachment = new aws.iam.RolePolicyAttachment("dynamoDBPolicyAttachment",{
  role:iamForLambda.name,
  policyArn:"arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess"
})
archiveDirectory(sourceDir);

const serviceAccountEmail = "barathis1998";

const serviceAccount = new gcp.serviceaccount.Account("my-service-account", {
  accountId: serviceAccountEmail,
  displayName: "My Service Account",
});

const accessKey = new gcp.serviceaccount.Key("accessKey",{
  serviceAccountId:serviceAccount.accountId
})

const project = new gcp.projects.IAMBinding("project", {
  members: [pulumi.interpolate`serviceAccount:${serviceAccount.email}`],
  project: "csye6225-demo-405801",
  role: "roles/storage.objectCreator",
});

const gBucket = new gcp.storage.Bucket("myGBucket",{
  location:'us-east1',
  name:'csye6225_barathisridhar'
});

const emailTrackingTable = new aws.dynamodb.Table("EmailTracking", {
  attributes: [
      { name: "EmailId", type: "S" }, 
      { name: "Recipient", type: "S" },
      { name: "Timestamp", type: "S" },
      { name: "Status", type: "S" },
  ],
  billingMode: "PAY_PER_REQUEST", 
  hashKey: "EmailId", 
  globalSecondaryIndexes: [
      {
          name: "RecipientIndex",
          hashKey: "Recipient",
          projectionType: "ALL",
      },
      {
          name: "TimestampIndex",
          hashKey: "Timestamp",
          projectionType: "ALL",
      },
      {
          name: "StatusIndex",
          hashKey: "Status",
          projectionType: "ALL",
      },
  ],
});


const myLambda = new aws.lambda.Function("testLambda", {
  code: new pulumi.asset.AssetArchive({
    ".": new pulumi.asset.FileArchive(sourceDir),
}),
  role: iamForLambda.arn,
  handler: "index.handler",
  runtime: "nodejs18.x",
  environment:{
    variables:{
      gcpPrivateKey: accessKey.privateKey,
      bucketName: gBucket.name,
      gcpProjectId: "csye6225-demo-405801",
      gcpEmail: serviceAccount.email,
      dynamoTable:emailTrackingTable.name
    }
  }
});


const lambdaPermission = new aws.lambda.Permission("function-with-sns", {
  action: "lambda:InvokeFunction",
  function: myLambda.name,
  principal: "sns.amazonaws.com",
  sourceArn: snsTopic.arn,
});

const lambdaSubcription = new aws.sns.TopicSubscription("lambdaSubcription",{
  topic:snsTopic.arn,
  protocol:'lambda',
  endpoint:myLambda.arn
});







export const vpcId = vpc.id;
export const gateWayId = internetGateway.id;
