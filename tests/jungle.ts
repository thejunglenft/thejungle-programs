import {
  setProvider,
  Provider,
  BN,
  Program,
  workspace,
} from "@project-serum/anchor";
import { Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Keypair } from "@solana/web3.js";
import { Jungle } from "../target/types/jungle";
import {
  airdropUsers,
  merkleCollection,
  mintAndTransferRewards,
} from "./helpers";
import { testClaimRewards } from "./suites/claimRewards";
import { testInitializeJungle } from "./suites/initJungle";
import { testSetJungle } from "./suites/setJungle";
import { testStakeAnimal } from "./suites/stakeAnimal";
import { testUnstakeAnimal } from "./suites/unstakeAnimal";
import { testWithdrawRewards } from "./suites/withdrawRewards";

describe("jungle", () => {
  const provider = Provider.local();
  setProvider(provider);

  const program = workspace.Jungle as Program<Jungle>;

  const state = {
    owner: Keypair.generate(),
    staker: Keypair.generate(),
    numberOfNfts: 10,
    mints: [],
    tree: undefined,
    jungleKey: Keypair.generate().publicKey,
    mintRewards: new Token(
      provider.connection,
      Keypair.generate().publicKey,
      TOKEN_PROGRAM_ID,
      Keypair.generate()
    ),
    maxMultiplier: new BN(20000),
    baseWeeklyEmissions: new BN(604800),
    start: new BN(Math.round(Date.now() / 1000)),
  };

  // before(async () => {
  //   await airdropUsers([state.owner, state.staker], provider);
  //   const mintInfo = await mintAndTransferRewards(
  //     provider,
  //     program.programId,
  //     state.jungleKey,
  //     state.owner,
  //     604800
  //   );
  //   state.mintRewards = mintInfo.mint;
  //   const nfts = await merkleCollection(
  //     state.owner,
  //     state.numberOfNfts,
  //     provider
  //   );
  //   state.mints = nfts.mints;
  //   state.tree = nfts.tree;
  // });

  // testInitializeJungle(state, provider);
  // testSetJungle(state, provider);
  // testWithdrawRewards(state, provider);
  // testStakeAnimal(state, provider);
  // testUnstakeAnimal(state, provider);
  // testClaimRewards(state, provider);
});
