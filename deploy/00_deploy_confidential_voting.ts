// deploy/00_deploy_confidential_voting.ts
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import fs from "fs";
import path from "path";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  log("🚀 Deploying ConfidentialVotingAutoRegister...");

  const durationInSeconds = 60 * 60 * 24; // 24 hours

  const deployment = await deploy("ConfidentialVotingAutoRegister", {
    from: deployer,
    args: [durationInSeconds],
    log: true,
    autoMine: true,
  });

  log(`✅ Deployed at: ${deployment.address}`);

  // Save contract address into .env (frontend uses NEXT_PUBLIC_CONTRACT_ADDRESS)
  const envPath = path.resolve(__dirname, "../.env");
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  if (envContent.includes("NEXT_PUBLIC_CONTRACT_ADDRESS=")) {
    envContent = envContent.replace(
      /NEXT_PUBLIC_CONTRACT_ADDRESS=.*/g,
      `NEXT_PUBLIC_CONTRACT_ADDRESS=${deployment.address}`
    );
  } else {
    envContent += `\nNEXT_PUBLIC_CONTRACT_ADDRESS=${deployment.address}\n`;
  }
  fs.writeFileSync(envPath, envContent);
  log("📝 Updated .env with NEXT_PUBLIC_CONTRACT_ADDRESS");

  // Try verifying if ETHERSCAN_API_KEY is available
  if (network.name === "sepolia" && process.env.ETHERSCAN_API_KEY) {
    try {
      log("🔍 Verifying on Etherscan...");
      await hre.run("verify:verify", {
        address: deployment.address,
        constructorArguments: [durationInSeconds],
      });
      log("✅ Verified on Etherscan");
    } catch (err) {
      log("⚠ Verification failed (maybe already verified):", err);
    }
  }
};

export default func;
func.tags = ["ConfidentialVotingAutoRegister"];
