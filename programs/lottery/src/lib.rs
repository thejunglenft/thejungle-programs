#![cfg_attr(feature = "no-entrypoint", allow(dead_code))]

use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;

use instructions::*;

declare_id!("6LUNT8JqxCKFw7u1R1PP2wgDTdgYskwGGFK1azVuzJZC");

#[program]
mod lottery {
    use super::*;

    /// Initializes the lottery
    pub fn initialize_lottery(
        ctx: Context<InitializeLottery>,
        bumps: InitializeLotteryBumps,
        period: u64,
        start: i64,
    ) -> ProgramResult {
        instructions::init_lottery::handler(ctx, bumps, period, start)
    }

    /// Initializes the lottery
    pub fn set_lottery(
        ctx: Context<SetLottery>,
        start: i64,
        owner: Pubkey,
        mint: Pubkey,
        treasury: Pubkey,
        period: i64,
    ) -> ProgramResult {
        instructions::set_lottery::handler(ctx, start, owner, mint, treasury, period)
    }

    /// Starts a new round of lottery with available balance
    pub fn new_lottery_round(
        ctx: Context<NewLotteryRound>,
        bump: u8
    ) -> ProgramResult {
        instructions::new_lottery_round::handler(ctx, bump)
    }

    /// Enter the lottery by spending staking rewards
    pub fn participate(ctx: Context<Participate>, bump: u8, spendings: [u64; 8]) -> ProgramResult {
        instructions::participate::handler(ctx, bump, spendings)
    }

    /// Update an existing participation
    pub fn update_participation(ctx: Context<UpdateParticipation>, spendings: [u64; 8]) -> ProgramResult {
        instructions::update_participation::handler(ctx, spendings)
    }

    /// Claim rewards of an expired lottery round
    pub fn claim_participation(ctx: Context<ClaimParticipation>) -> ProgramResult {
        instructions::claim_participation::handler(ctx)
    }
}

// Jungle factions:
//     None = 0,
//     Sarengti = 1,
//     Amphibian = 2,
//     Reptile = 3,
//     Misfit = 4,
//     Bird = 5,
//     Monkey = 6,
//     Carnivore = 7,
//     Extinct = 8,

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default)]
pub struct InitializeLotteryBumps {
    pub lottery: u8,
    pub escrow: u8,
    pub round: u8,
}

/// The Deep Jungle lottery
#[account]
#[derive(Default)]
pub struct Lottery {
    /// The bumps used to generate the PDA
    pub bumps: InitializeLotteryBumps,

    /// The unique identifier of the lottery
    pub key: Pubkey,

    /// The owner of the lottery
    pub owner: Pubkey,

    /// The mint of ticket spent by players
    pub mint: Pubkey,

    /// The account holding the winning pot
    pub escrow: Pubkey,

    /// The account receiving spent tokens
    pub treasury: Pubkey,

    /// The period between rounds (in seconds)
    pub period: u64,

    /// The index of the last round
    pub last_round: u64,

    /// The timestamp of the last round
    pub last_timestamp: i64,

    /// The amount of unclaimed SOL
    pub unclaimed_pot: u64,
}

/// A single round of lottery
#[account]
#[derive(Default)]
pub struct LotteryRound {
    /// The bump used to generate the PDA
    pub bump: u8,

    /// The index of this round
    pub index: u64,

    /// The time at which the round started
    pub start: i64,

    /// The amount of tickets spent by each faction
    pub spendings: [u64; 8],

    /// The amount of SOL that winners will share
    pub pot: u64,

    /// The faction that won this round
    pub winner: u8,
}

/// A user participation in a round of lottery
#[account]
#[derive(Default)]
pub struct LotteryParticipation {
    /// The bump used to generate the PDA
    pub bump: u8,

    /// The player who participates
    pub player: Pubkey,

    /// The index of this participation's round
    pub index: u64,

    /// The amount of tickets spent by each faction
    pub spendings: [u64; 8],
}
