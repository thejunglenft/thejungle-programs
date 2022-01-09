import fs from "fs";
import {
  Program,
  Provider,
  setProvider,
  web3,
  Wallet,
  Idl,
} from "@project-serum/anchor";
import { BN } from "@project-serum/anchor";
import { Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import { buildLeaves } from "../tests/helpers";
import { MerkleTree } from "../tests/helpers/merkleTree";

import key from "../key.json";
import config from "../config.json";
import { Jungle, IDL as JungleIDL } from "../target/types/jungle";
import { Lottery, IDL as LotteryIDL } from "../target/types/lottery";
import jungleIdl from "../target/idl/jungle.json";
import lotteryIdl from "../target/idl/lottery.json";

const factionToNumber = (faction: string) => {
  switch (faction) {
    case "Sarengti":
      return 1;
    case "Amphibian":
      return 2;
    case "Reptile":
      return 3;
    case "Misfit":
      return 4;
    case "Bird":
      return 5;
    case "Monkey":
      return 6;
    case "Carnivore":
      return 7;
    case "Mythic":
      return 8;
    default:
      throw new Error("unknown faction");
  }
};

/**
 * Initializes a Jungle staking and a lottery paid with staking rewards
 * @param network The network to which the program is deployed
 */
const reset = async (network: string) => {
  if (network !== "devnet" && network !== "mainnet")
    throw new Error("Missing network argument");

  let endpoint;
  let mints = [];
  if (network === "devnet") {
    endpoint = "https://api.devnet.solana.com";
    mints = JSON.parse(fs.readFileSync("./assets/devnetMints.json").toString());
  } else if (network === "mainnet") {
    endpoint = "https://api.mainnet-beta.solana.com";
    mints = JSON.parse(
      fs.readFileSync("./assets/mainnetMints.json").toString()
    );
  }

  const connection = new web3.Connection(endpoint);
  const wallet = new Wallet(web3.Keypair.fromSecretKey(Uint8Array.from(key)));
  const provider = new Provider(connection, wallet, {
    preflightCommitment: "confirmed",
  });
  setProvider(provider);

  let deployments = JSON.parse(
    fs.readFileSync("./deployments.json").toString()
  );

  if (!Object.keys(deployments).includes(network))
    throw new Error("No previous deployments for this network");

  // Create the reward token
  const mintRewards = new Token(
    connection,
    new PublicKey(deployments[network].jungleRewardMint),
    TOKEN_PROGRAM_ID,
    wallet.payer
  );

  const jungleProgram = new Program<Jungle>(
    JungleIDL,
    jungleIdl.metadata.address,
    provider
  );
  const lotteryProgram = new Program<Lottery>(
    LotteryIDL,
    lotteryIdl.metadata.address,
    provider
  );

  // EDIT THE `config.json` FILE
  const jungleKey = new PublicKey(deployments[network].jungleKey);
  const lotteryKey = new PublicKey(deployments[network].lotteryKey);
  const totalSupply = new BN(config.totalSupply);
  const maxMultiplier = new BN(config.maxMultiplier);
  const maxRarity = new BN(config.maxRarity);
  const baseWeeklyEmissions = new BN(config.weeklyRewards).mul(new BN(10 ** 9));
  const lotteryPeriod = new BN(config.lotteryPeriod);
  const start = new BN(config.start);

  const leaves = buildLeaves(
    mints.map((e, i) => ({
      mint: new PublicKey(e.mint),
      rarity: e.rarity,
      faction: factionToNumber(e.faction),
    }))
  );
  const tree = new MerkleTree(leaves);

  const [jungleAddress, jungleBump] = await PublicKey.findProgramAddress(
    [Buffer.from("jungle", "utf8"), jungleKey.toBuffer()],
    jungleProgram.programId
  );
  const [escrow, escrowBump] = await PublicKey.findProgramAddress(
    [Buffer.from("escrow", "utf8"), jungleKey.toBuffer()],
    jungleProgram.programId
  );
  const [rewards, rewardsBump] = await PublicKey.findProgramAddress(
    [
      Buffer.from("rewards", "utf8"),
      jungleKey.toBuffer(),
      mintRewards.publicKey.toBuffer(),
    ],
    jungleProgram.programId
  );

  console.log("Jungle key:", jungleKey.toString());
  console.log("Lottery key:", lotteryKey.toString());
  console.log("Owner:", wallet.payer.publicKey.toString());
  console.log("Program ID:", jungleProgram.programId.toString());
  console.log("Jungle:", jungleAddress.toString());
  console.log("Escrow:", escrow.toString());

  await jungleProgram.rpc.setJungle(
    maxRarity,
    maxMultiplier,
    baseWeeklyEmissions,
    start,
    tree.getRootArray(),
    {
      accounts: {
        jungle: jungleAddress,
        owner: wallet.payer.publicKey,
        newOwner: wallet.payer.publicKey,
      },
      signers: [wallet.payer],
    }
  );

  // Initialize the lottery
  const [lotteryAddress, lotteryBump] = await PublicKey.findProgramAddress(
    [Buffer.from("lottery", "utf8"), lotteryKey.toBuffer()],
    lotteryProgram.programId
  );

  await lotteryProgram.rpc.setLottery(
    start,
    wallet.payer.publicKey,
    mintRewards.publicKey,
    rewards,
    lotteryPeriod,
    {
      accounts: {
        lottery: lotteryAddress,
        owner: wallet.payer.publicKey,
      },
      signers: [wallet.payer],
    }
  );
};

reset(process.argv[2]);
