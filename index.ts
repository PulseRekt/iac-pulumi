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

const vpcCidrBlock = '10.0.0.0/16';
const subnetMask = '255.255.240.0';

const numberOfSubnets = 6;


// const calculateValidSubnets = (
//   numberOfSubnets: number,
//   vpcCidrBlock: string
// ): string[] => {
//   const subnetPrefixLength = subnetCalculator.calculateCIDRPrefix(numberOfSubnets,subnetMask);

//   const vpcCidrParts = vpcCidrBlock.split(".");
//   const subnetCidrBlocks: string[] = [];
//   for (let i = 0; i < numberOfSubnets; i++) {
//     const subnet = `${vpcCidrParts[0]}.${vpcCidrParts[1]}.${i * subnetPrefixLength}.0/${subnetPrefixLength}`;
//     subnetCidrBlocks.push(subnet);
//   }

//   return subnetCidrBlocks;
// };
// const subnets = calculateValidSubnets(numberOfSubnets, vpcCidrBlock);


const publicSubnetCidrBlocks: string[] = [];
const privateSubnetCidrBlocks: string[] = [];
const vpcCidrParts = vpcCidrBlock.split(".");
const vpcNetwork = vpcCidrParts[0] + "." + vpcCidrParts[1];

for (let i = 1; i <= 3; i++) {
  const publicSubnetCIDR = vpcNetwork+`.${i}.0`+"/24";
  const privateSubnetCIDR = vpcNetwork+`.${i+3}.0`+"/24";;
  publicSubnetCidrBlocks.push(publicSubnetCIDR);
  privateSubnetCidrBlocks.push(privateSubnetCIDR);
}


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
  });


});



  export const vpcId = vpc.id;
  export const gateWayId = internetGateway.id;

  