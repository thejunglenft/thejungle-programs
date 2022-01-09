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
const initialize = async (network: string) => {
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

  // Create the reward token
  const mintRewards = await Token.createMint(
    connection,
    wallet.payer,
    wallet.payer.publicKey,
    null,
    9,
    TOKEN_PROGRAM_ID
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
  const jungleKey = Keypair.generate().publicKey;
  const lotteryKey = Keypair.generate().publicKey;
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

  try {
    const bumps = {
      jungle: jungleBump,
      escrow: escrowBump,
      rewards: rewardsBump,
    };

    await jungleProgram.rpc.initializeJungle(
      bumps,
      maxRarity,
      maxMultiplier,
      baseWeeklyEmissions,
      start,
      tree.getRootArray(),
      {
        accounts: {
          jungleKey: jungleKey,
          jungle: jungleAddress,
          escrow: escrow,
          mint: mintRewards.publicKey,
          rewardsAccount: rewards,
          owner: wallet.payer.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
          systemProgram: SystemProgram.programId,
        },
        signers: [wallet.payer],
      }
    );
  } catch (err) {
    console.log("Jungle already existed? Trying to set it instead...");
    console.log(err);
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
  }

  // Mint the supply to the owner
  const ownerAccount = await mintRewards.getOrCreateAssociatedAccountInfo(
    wallet.publicKey
  );
  await mintRewards.mintTo(
    ownerAccount.address,
    wallet.payer,
    [],
    totalSupply.mul(new BN(10 ** 9)).toNumber()
  );

  // Send token to the distributor
  await mintRewards.transfer(
    ownerAccount.address,
    rewards,
    wallet.payer,
    [],
    totalSupply
      .mul(new BN(10 ** 9))
      .div(new BN(2))
      .toNumber()
  );
  console.log("Gave rewards to the Jungle");

  // Initialize the lottery
  const [lotteryAddress, lotteryBump] = await PublicKey.findProgramAddress(
    [Buffer.from("lottery", "utf8"), lotteryKey.toBuffer()],
    lotteryProgram.programId
  );
  const [lotteryEscrow, lotteryEscrowBump] = await PublicKey.findProgramAddress(
    [Buffer.from("escrow", "utf8"), lotteryKey.toBuffer()],
    lotteryProgram.programId
  );
  const [round, roundBump] = await PublicKey.findProgramAddress(
    [
      Buffer.from("round", "utf8"),
      lotteryKey.toBuffer(),
      new BN(0).toBuffer("le", 8),
    ],
    lotteryProgram.programId
  );

  try {
    const bumps = {
      lottery: lotteryBump,
      escrow: lotteryEscrowBump,
      round: roundBump,
    };

    await lotteryProgram.rpc.initializeLottery(bumps, lotteryPeriod, start, {
      accounts: {
        lotteryKey: lotteryKey,
        lottery: lotteryAddress,
        lotteryRound: round,
        escrow: lotteryEscrow,
        mint: mintRewards.publicKey,
        treasury: rewards,
        owner: wallet.payer.publicKey,
        rent: SYSVAR_RENT_PUBKEY,
        systemProgram: SystemProgram.programId,
      },
      signers: [wallet.payer],
    });
  } catch (err) {
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
  }

  let deployments = {};
  try {
    deployments = JSON.parse(fs.readFileSync("./deployments.json").toString());
  } catch (err) {}

  deployments[network] = {
    jungleProgram: jungleIdl.metadata.address.toString(),
    jungleKey: jungleKey.toString(),
    jungleEscrowKey: escrow.toString(),
    jungleRewardMint: mintRewards.publicKey.toString(),
    lotteryProgram: lotteryIdl.metadata.address.toString(),
    lotteryKey: lotteryKey.toString(),
    lotteryEscrowKey: lotteryEscrow.toString(),
  };

  fs.writeFileSync("./deployments.json", JSON.stringify(deployments, null, 2));
};

initialize(process.argv[2]);
