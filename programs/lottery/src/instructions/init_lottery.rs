use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

use crate::{InitializeLotteryBumps, Lottery, LotteryRound};

#[derive(Accounts)]
#[instruction(bumps: InitializeLotteryBumps)]
pub struct InitializeLottery<'info> {
    /// The unique identifier of the lottery
    pub lottery_key: AccountInfo<'info>,

    /// The lottery
    #[account(
        init,
        payer = owner,
        seeds = [
            b"lottery",
            lottery_key.key().as_ref()
        ],
        bump = bumps.lottery,
    )]
    pub lottery: Account<'info, Lottery>,

    /// The first lottery round
    #[account(
        init,
        payer = owner,
        seeds = [
            b"round",
            lottery_key.key().as_ref(),
            0_u64.to_le_bytes().as_ref()
        ],
        bump = bumps.round,
    )]
    pub lottery_round: Account<'info, LotteryRound>,

    /// The account holding the winning pot
    #[account(
        seeds = [
            b"escrow".as_ref(),
            lottery_key.key().as_ref()
        ],
        bump = bumps.escrow
    )]
    pub escrow: AccountInfo<'info>,

    /// The mint of tickets
    #[account(mut)]
    pub mint: AccountInfo<'info>,

    /// The account receiving the spent tickets
    #[account(mut, constraint = treasury.mint == mint.key())]
    pub treasury: Account<'info, TokenAccount>,

    /// The owner of the lottery
    #[account(mut)]
    pub owner: Signer<'info>,

    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}

/// Initializes a lottery
pub fn handler(
    ctx: Context<InitializeLottery>,
    bumps: InitializeLotteryBumps,
    period: u64,
    start: i64,
) -> ProgramResult {
    let lottery = &mut ctx.accounts.lottery;
    lottery.bumps = bumps;
    lottery.key = ctx.accounts.lottery_key.key();
    lottery.owner = ctx.accounts.owner.key();
    lottery.mint = ctx.accounts.mint.key();
    lottery.escrow = ctx.accounts.escrow.key();
    lottery.treasury = ctx.accounts.treasury.key();
    lottery.period = period;
    lottery.last_timestamp = start;

    let lottery_round = &mut ctx.accounts.lottery_round;
    lottery_round.bump = bumps.round;
    lottery_round.index = lottery.last_round;
    lottery_round.start = lottery.last_timestamp;
    lottery_round.pot = 0;

    msg!("Lottery initialized");

    Ok(())
}
