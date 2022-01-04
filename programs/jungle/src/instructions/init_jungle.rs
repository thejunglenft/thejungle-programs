use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

use crate::errors::*;
use crate::{Jungle, InitializeJungleBumps};

#[derive(Accounts)]
#[instruction(bumps: InitializeJungleBumps)]
pub struct InitializeJungle<'info> {
    /// The unique identifier.
    /// Allows reusing this program for other projects without redeploying
    pub jungle_key: AccountInfo<'info>,

    /// The Jungle
    #[account(
        init,
        payer = owner,
        seeds = [
            b"jungle",
            jungle_key.key().as_ref()
        ],
        bump = bumps.jungle,
    )]
    pub jungle: Account<'info, Jungle>,

    /// The account holding staking tokens, staking rewards and community funds
    #[account(
        seeds = [
            b"escrow",
            jungle_key.key().as_ref()
        ],
        bump = bumps.escrow,
    )]
    pub escrow: AccountInfo<'info>,

    /// The mint of the staking token
    pub mint: AccountInfo<'info>,

    /// The account that will hold the exhibition token
    #[account(
        init,
        payer = owner,
        seeds = [
            b"rewards",
            jungle_key.key().as_ref(),
            mint.key().as_ref()
        ],
        bump = bumps.rewards,
        token::mint = mint,
        token::authority = escrow
    )]
    pub rewards_account: Account<'info, TokenAccount>,

    /// The wallet owning the jungle
    #[account(mut)]
    pub owner: Signer<'info>,

    /// The program for interacting with the token.
    #[account(address = token::ID)]
    pub token_program: Program<'info, Token>,

    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}

/// Initializes the jungle parameters
pub fn handler(
    ctx: Context<InitializeJungle>,
    bumps: InitializeJungleBumps,
    max_rarity: u64,
    max_multiplier: u64,
    base_weekly_emissions: u64,
    start: i64,
    root: [u8; 32],
) -> ProgramResult {
    msg!("Init Jungle");
    if max_multiplier < 10000 {
        return Err(ErrorCode::InvalidMultiplier.into());
    }

    let jungle = &mut ctx.accounts.jungle;
    jungle.key = ctx.accounts.jungle_key.key();
    jungle.owner = ctx.accounts.owner.key();
    jungle.bumps = bumps;
    jungle.escrow = ctx.accounts.escrow.key();
    jungle.mint = ctx.accounts.mint.key();
    jungle.rewards_account = ctx.accounts.rewards_account.key();
    jungle.maximum_rarity = max_rarity;
    jungle.maximum_rarity_multiplier = max_multiplier;
    jungle.base_weekly_emissions = base_weekly_emissions;
    jungle.start = start;
    jungle.root = root;

    msg!("Jungle initialized");

    Ok(())
}
