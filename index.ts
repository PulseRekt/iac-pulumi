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

// export const calculateValidSubnets = (
//   vpcCidrBlock: string,
//   numberOfSubnets: number
// ): { publicSubnets: string[]; privateSubnets: string[] } => {
//   // Calculate the subnet prefix length.
//   const subnetPrefixLength = subnetCalculator.calculateCIDRPrefix(numberOfSubnets,subnetMask);
//   console.log(subnetPrefixLength);

//   // Calculate the number of public and private subnets.
//   const numberOfPublicSubnets = Math.floor(numberOfSubnets / 2);
//   const numberOfPrivateSubnets = numberOfSubnets - numberOfPublicSubnets;

//   // Calculate the CIDR block for each public subnet.
//   const publicSubnets: string[] = [];
//   for (let i = 0; i < numberOfPublicSubnets; i++) {
//     const vpcCidrParts = vpcCidrBlock.split(".");
//     const subnetCIDRBlock = `${vpcCidrParts[0]}.${vpcCidrParts[1]}.${parseInt(i * subnetPrefixLength, 10)}.0/${subnetPrefixLength}`;
//     publicSubnets.push(subnetCIDRBlock);
//   }

//   // Calculate the CIDR block for each private subnet.
//   const privateSubnets: string[] = [];
//   for (let i = numberOfPublicSubnets; i < numberOfSubnets; i++) {
//     const vpcCidrParts = vpcCidrBlock.split(".");
//     const subnetCIDRBlock = `${vpcCidrParts[0]}.${vpcCidrParts[1]}.${(i * subnetPrefixLength).toString()}.0/${subnetPrefixLength}`;
//     privateSubnets.push(subnetCIDRBlock);
//   }

//   return { publicSubnets, privateSubnets };
// };


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

  