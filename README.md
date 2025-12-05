# DID Terms: A Privacy-First Social Network Powered by Zama FHE 

DID Terms is an innovative social protocol that empowers users to attach FHE-encrypted "terms" directly to their Decentralized Identifiers (DIDs). Harnessing **Zama's Fully Homomorphic Encryption technology**, this platform allows users to set strict privacy conditions around their personal data, ensuring that entities interacting with their DIDs must first prove compliance with these conditions without ever seeing the underlying data.

## Understanding the Pain Point

In today's digital landscape, users often feel powerless over their own data. Existing social networks and applications exploit user information for advertising and other purposes, often without transparent consent. The rise of regulations such as GDPR underscores the pressing need for mechanisms that allow users to control how their data is used. However, many current solutions fail to provide real user-oriented privacy, relying instead on vague agreements that are easily disregarded.

## The FHE Solution

The core innovation of DID Terms lies in its use of **Fully Homomorphic Encryption (FHE)** to create enforceable privacy conditions. By integrating Zama's open-source libraries, such as the **Concrete** and **TFHE-rs**, the platform allows decentralized apps (dApps) to perform compliance checks homomorphically. This means that dApps can validate user terms without actually accessing the data, ensuring privacy is not just a promise but a technical reality. With our solution, users transform the concept of "consent" from a simple agreement into a programmable enforcement mechanism.

## Core Features

- 🔒 **User-defined Privacy Terms:** Users can securely set FHE-encrypted privacy terms for their DIDs, ensuring that their data is not used for advertising or any other unintended purposes.
- ✅ **Homomorphic Compliance Verification:** dApps can homomorphically verify compliance with the user-defined terms before engaging, which enhances user trust and platform integrity.
- 🛠️ **Programmable Enforcement:** Move beyond traditional consent to enforceable compliance, converting user privacy from a simple agreement into a robust mechanism for data protection.
- 🌐 **Decentralized Identity Management:** Seamlessly manage DIDs and set permissions for various dApps to interact with your identity.

## Technology Stack

- **Zama FHE SDK**: Central component for implementing Fully Homomorphic Encryption.
- **Node.js**: JavaScript runtime for building scalable network applications.
- **Hardhat**: Ethereum development environment for compiling, deploying, and testing smart contracts.
- **Solidity**: Smart contract programming language for building decentralized applications.

## Directory Structure

Here’s a brief look at the directory structure of the project:

```
DID_Terms_Fhe/
├── contracts/
│   └── DID_Terms.sol
├── src/
│   ├── index.js
│   └── utils.js
├── script/
│   └── deploy.js
├── test/
│   └── DID_Terms.test.js
├── package.json
└── README.md
```

## Installation Guide

To set up the DID Terms project on your local machine, please follow the steps below. Ensure you have Node.js and Hardhat installed on your system.

1. **Download the Project**: Obtain the project files without using `git clone`.
2. **Navigate to the Project Directory**: Open your terminal and change to the directory where you saved the project.
3. **Install Dependencies**: Run the command below to install the required packages, including Zama FHE libraries.

   ```bash
   npm install
   ```

## Build & Run Guide

Once you have successfully installed the dependencies, you can build and run the project using the commands outlined below.

1. **Compile Smart Contracts**: To compile the smart contracts, use the following command:

   ```bash
   npx hardhat compile
   ```

2. **Run Tests**: Execute the tests to ensure everything is functioning as expected:

   ```bash
   npx hardhat test
   ```

3. **Deploy the Smart Contracts**: You can deploy your smart contracts to a local or test Ethereum network with:

   ```bash
   npx hardhat run script/deploy.js --network localhost
   ```

## Example Code Snippet

Below is a code snippet demonstrating how to set FHE-encrypted privacy terms for a user’s DID:

```javascript
const { encryptTerms, verifyCompliance } = require('./utils');

async function setPrivacyTerms(userId, terms) {
    const encryptedTerms = encryptTerms(userId, terms);
    await database.saveTerms(userId, encryptedTerms);
    
    console.log(`Privacy terms set for user ${userId}`);
}

async function checkCompliance(userId, dAppRequest) {
    const encryptedTerms = await database.getTerms(userId);
    const complianceResult = await verifyCompliance(encryptedTerms, dAppRequest);
    
    return complianceResult;
}
```

In this example, `encryptTerms` uses Zama's FHE libraries to protect user-defined terms, while `verifyCompliance` checks if a dApp meets the privacy requirements.

## Acknowledgements

This project is **Powered by Zama**. We extend our heartfelt thanks to the Zama team for their pioneering work in developing the open-source tools that enable the creation of confidential blockchain applications. Their commitment to privacy and security through FHE technology makes innovations like DID Terms possible.
