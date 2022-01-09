#![cfg_attr(feature = "no-entrypoint", allow(dead_code))]

use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod merkle_proof;

use instructions::*;

declare_id!("8XgPs7DNb7jvZqu5Y6zbF1idvrXnLtHZK4kVGKALd9fS");

#[program]
mod jungle {
    use super::*;

    /// Initializes the jungle
    pub fn initialize_jungle(
        ctx: Context<InitializeJungle>,
        bumps: InitializeJungleBumps,
        max_rarity: u64,
        max_multiplier: u64,
        base_weekly_emissions: u64,
        start: i64,
        root: [u8; 32],
    ) -> ProgramResult {
        instructions::init_jungle::handler(
            ctx,
            bumps,
            max_rarity,
            max_multiplier,
            base_weekly_emissions,
            start,
            root,
        )
    }

    /// Sets the jungle parameters
    pub fn set_jungle(
        ctx: Context<SetJungle>,
        max_rarity: u64,
        max_multiplier: u64,
        base_weekly_emissions: u64,
        start: i64,
        root: [u8; 32],
    ) -> ProgramResult {
        instructions::set_jungle::handler(
            ctx,
            max_rarity,
            max_multiplier,
            base_weekly_emissions,
            start,
            root,
        )
    }

    /// Withdraw rewards from the vault
    pub fn withdraw_rewards(
        ctx: Context<WithdrawRewards>,
        amount: u64
    ) -> ProgramResult {
        instructions::withdraw_rewards::handler(
            ctx,
            amount
        )
    }

    /// Stake an animal
    pub fn stake_animal(
        ctx: Context<StakeAnimal>,
        bumps: StakeAnimalBumps,
        proof: Vec<[u8; 32]>,
        rarity: u64,
        faction: u64,
    ) -> ProgramResult {
        instructions::stake_animal::handler(ctx, bumps, proof, rarity, faction)
    }

    /// Unstake a staked animal
    pub fn unstake_animal(ctx: Context<UnstakeAnimal>) -> ProgramResult {
        instructions::unstake_animal::handler(ctx)
    }

    /// Claim staking rewards
    pub fn claim_staking(ctx: Context<ClaimStaking>) -> ProgramResult {
        instructions::claim_staking::handler(ctx)
    }

    // /// Enter the lottery by spending staking rewards
    // pub fn enter_lottery(ctx: Context<Participate>, bump: u8, spendings: [u64; 8]) -> ProgramResult {
    //     instructions::participate::handler(ctx, bump, spendings)
    // }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct InitializeJungleBumps {
    pub jungle: u8,
    pub escrow: u8,
    pub rewards: u8,
}

/// The global state of the program
#[account]
#[derive(Default)]
pub struct Jungle {
    /// The identifier
    pub key: Pubkey,

    /// The owner of the program
    pub owner: Pubkey,

    /// The bump used to generate PDAs
    pub bumps: InitializeJungleBumps,

    /// The PDA owning the community fund
    pub escrow: Pubkey,

    /// The mint of the token distributed to stakers
    pub mint: Pubkey,

    /// The account owning tokens distributed to stakers
    pub rewards_account: Pubkey,

    /// The total animals currently staked.
    pub animals_staked: u64,

    /// The maximum rarity value
    /// Any rarity below this will be cut off
    pub maximum_rarity: u64,

    /// The rarity multiplier for staking rewards, in basis points
    pub maximum_rarity_multiplier: u64,

    /// The amount of tokens emitted each week
    pub base_weekly_emissions: u64,

    /// The time the staking starts (in seconds since 1970)
    pub start: i64,

    /// The root of the merkle tree used to know if a token is part of the collection
    pub root: [u8; 32],
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

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct StakeAnimalBumps {
    pub animal: u8,
    pub deposit: u8,
}

/// The staking account linked to the NFT
#[account]
#[derive(Default)]
pub struct Animal {
    /// Bump used to create this PDA
    pub bumps: StakeAnimalBumps,

    /// The mint of the NFT
    pub mint: Pubkey,

    /// Owner of the animal
    pub staker: Pubkey,

    /// How rare the animal is
    pub rarity: u64,

    /// The wallet to which fees are given
    pub faction: u8,

    /// Last time the owner claimed rewards
    pub last_claim: i64,
}

impl Animal {
    pub const LEN: usize = 8 + 2 + 40 + 40 + 8 + 1 + 8;
}
