import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";


const publicSubnetCidrBlocks = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"];
const privateSubnetCidrBlocks = ["10.0.4.0/24", "10.0.5.0/24", "10.0.6.0/24"];

const vpc = new aws.ec2.Vpc("my-vpc", {
    cidrBlock: "10.0.0.0/16",

  });


  const internetGateway = new aws.ec2.InternetGateway("myIGW", {
    vpcId: vpc.id,
  });

  const publicSubnets = publicSubnetCidrBlocks.map((cidr,index)=>{
    const availabilityZone = `us-east-1${String.fromCharCode(97 + index)}`;

    return new aws.ec2.Subnet(`PublicSubnet-${index}`,{
      vpcId:vpc.id,
      cidrBlock:cidr,
      availabilityZone:availabilityZone,
      mapPublicIpOnLaunch:true
    });
  });

  const publicRouteTable = new aws.ec2.RouteTable('PublicRouteTable',{
    vpcId:vpc.id,
    routes:[{
      cidrBlock:"0.0.0.0/0",
      gatewayId:internetGateway.id
    }
    ]
  })

  publicSubnets.forEach((subnet,index)=>{
    const subnetAssociation = new aws.ec2.RouteTableAssociation(`PubliSubnetAssociation-${index}`,{
      subnetId:subnet.id,
      routeTableId: publicRouteTable.id
    })
  })


  const privateSubnets = privateSubnetCidrBlocks.map((cidr,index)=>{
    const availabilityZone = `us-east-1${String.fromCharCode(97 + index)}`;

    return new aws.ec2.Subnet(`PrivateSubnet-${index}`,{
      vpcId:vpc.id,
      cidrBlock:cidr,
      availabilityZone:availabilityZone,
    })
  })

  const privateRouteTable = new aws.ec2.RouteTable('PrivateTable',{
    vpcId:vpc.id,
  })

  privateSubnets.forEach((subnet,index)=>{
    const subnetAssociation = new aws.ec2.RouteTableAssociation(`PrivateSubnetAssociation-${index}`,{
      subnetId:subnet.id,
      routeTableId:privateRouteTable.id
    })
  })


  export const vpcId = vpc.id;
  export const gateWayId = internetGateway.id;
  export const privateRouteTableId = privateRouteTable.id;
  export const publicRouteTableId = publicRouteTable.id;
  