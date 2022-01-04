use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Token, TokenAccount, Transfer};

use crate::{Animal, Jungle};

#[derive(Accounts)]
pub struct UnstakeAnimal<'info> {
    /// The Jungle
    #[account(
        mut,
        seeds = [
            b"jungle",
            jungle.key.as_ref()
        ],
        bump = jungle.bumps.jungle
    )]
    pub jungle: Account<'info, Jungle>,

    /// The account holding staking tokens, staking rewards and community funds
    #[account(
        seeds = [
            b"escrow",
            jungle.key.as_ref()
        ],
        bump = jungle.bumps.escrow
    )]
    pub escrow: AccountInfo<'info>,

    /// The staking account
    #[account(
        mut,
        close = staker,
        has_one = mint,
        has_one = staker
    )]
    pub animal: Account<'info, Animal>,

    /// The owner of the animal
    #[account(mut)]
    pub staker: Signer<'info>,

    /// The mint of the staked token
    #[account(mut)]
    pub mint: AccountInfo<'info>,

    /// The account that will hold the unstaked token
    #[account(
        mut,
        has_one = mint,
        constraint = staker_account.owner == staker.key()
    )]
    pub staker_account: Account<'info, TokenAccount>,

    /// The account that holds the staked token
    #[account(
        mut,
        seeds = [
            b"deposit".as_ref(),
            mint.key().as_ref()
        ],
        bump = animal.bumps.deposit,
        has_one = mint
    )]
    pub deposit_account: Account<'info, TokenAccount>,

    /// The program for interacting with the token.
    #[account(address = token::ID)]
    pub token_program: Program<'info, Token>,
}

/// Unstake the animal
pub fn handler(ctx: Context<UnstakeAnimal>) -> ProgramResult {
    let jungle = &mut ctx.accounts.jungle;
    jungle.animals_staked -= 1;

    let seeds = &[
        b"escrow".as_ref(),
        jungle.key.as_ref(),
        &[jungle.bumps.escrow],
    ];
    let signer = &[&seeds[..]];

    // Return the animal NFT
    let context = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.deposit_account.to_account_info(),
            to: ctx.accounts.staker_account.to_account_info(),
            authority: ctx.accounts.escrow.to_account_info(),
        },
        signer,
    );
    token::transfer(context, 1)?;

    // Close the staking token account
    let close_account_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        CloseAccount {
            account: ctx.accounts.deposit_account.to_account_info(),
            destination: ctx.accounts.staker.to_account_info(),
            authority: ctx.accounts.escrow.to_account_info(),
        },
        signer,
    );
    token::close_account(close_account_ctx)?;

    msg!("Unstaked token");

    Ok(())
}
