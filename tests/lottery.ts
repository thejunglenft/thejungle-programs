import { setProvider, Provider } from "@project-serum/anchor";
import { testClaimParticipation } from "./suites/claimParticipation";
import { testInitializeLottery } from "./suites/initLottery";
import { testNewLotteryRound } from "./suites/newLotteryRound";
import { testParticipate } from "./suites/participate";
import { testSetLottery } from "./suites/setLottery";
import { testUpdateParticipation } from "./suites/updateParticipation";

describe("Lottery", () => {
  const provider = Provider.local();
  setProvider(provider);

  testInitializeLottery(provider);
  testSetLottery(provider);
  testNewLotteryRound(provider);
  testParticipate(provider);
  testUpdateParticipation(provider);
  testClaimParticipation(provider);
});
