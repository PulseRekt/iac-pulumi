# AWS CLI and Pulumi Setup

This guide will help you set up the AWS Command Line Interface (CLI) and Pulumi for managing AWS resources.

## AWS CLI Setup

### 1. Installation
- Install the AWS CLI using the GUI installer.

### 2. Verification
- Open your terminal and run `aws --version` to ensure a successful installation.

### 3. Create IAM User
- Create an IAM user in the AWS Console and attach the `AdministratorAccess` policy.

### 4. Generate Access Keys
- Generate Access Key and Secret Access Key in the AWS Console for the IAM user created in step 3.

## AWS CLI Profile Setup

### 1. Configure Profile
- In your terminal, run `aws configure --profile <profile_name>` to configure an AWS CLI profile.

### 2. Credentials and Settings
- Enter the Access Key, Secret Access Key, region, and output format when prompted.

### 3. Profile Configuration
- AWS CLI will create configuration files in `~/.aws` to store your profile information.

- To list a specific profile, use `aws configure list --profile <profile_name`.
- To list all profiles, use `aws configure list-profiles`.

## Pulumi Setup

### 1. Installation
- Install Pulumi by running `brew install pulumi/tap/pulumi`.

### 2. Version Check
- Verify the installed Pulumi version with `pulumi version`.

### 3. Local Pulumi Login
- To store credentials locally (instead of Pulumi Cloud), run `pulumi login --local`.

### 4. Initialize Project
- Navigate to your project directory and run `pulumi new`. This will prompt you to select a stack for your preferred programming language. Set a passphrase for accessing Pulumi.

## Setting the AWS Region for Pulumi

- Use the command `pulumi config set aws:region <region_name>` to set the region from the command line for AWS.

## Running Pulumi

- Deploy your Pulumi infrastructure with `pulumi up`. You will be prompted to enter the passphrase for Pulumi.

- To destroy created resources or perform updates, use `pulumi destroy` or `pulumi up` as needed.


# SSL Certificate Import and AWS ACM Configuration

This guide covers the steps to generate a CSR in Namecheap, import an SSL certificate into AWS ACM using the AWS CLI, and configure it with a named profile.

## Prerequisites

- [AWS CLI](https://aws.amazon.com/cli/) installed.

## Step 1: Generate CSR in Namecheap

1. Log in to [Namecheap](https://www.namecheap.com/).
2. Navigate to SSL Certificates.
3. Purchase or manage a certificate.
4. Generate a CSR and save it along with the private key.

## Step 2: Import SSL Certificate into AWS ACM

```bash
aws acm import-certificate \
  --certificate fileb:///path/to/certificate.crt \
  --private-key fileb:///path/to/private-key.pem \
  --certificate-chain fileb:///path/to/certificate-chain.pem \
  --profile your_aws_cli_profile

