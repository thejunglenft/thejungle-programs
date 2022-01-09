use anchor_lang::prelude::*;

use crate::errors::*;
use crate::{Lottery, LotteryRound};

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct NewLotteryRound<'info> {
    /// The lottery
    #[account(
        mut,
        seeds = [
            b"lottery",
            lottery.key.as_ref()
        ],
        bump = lottery.bumps.lottery,
    )]
    pub lottery: Account<'info, Lottery>,

    /// The account holding the funds
    #[account(
        seeds = [
            b"escrow",
            lottery.key.as_ref()
        ],
        bump = lottery.bumps.escrow
    )]
    pub escrow: AccountInfo<'info>,

    /// The lottery round
    #[account(
        init,
        payer = payer,
        seeds = [
            b"round",
            lottery.key.as_ref(),
            (lottery.last_round + 1).to_le_bytes().as_ref()
        ],
        bump = bump,
    )]
    pub lottery_round: Account<'info, LotteryRound>,

    /// The lottery round
    #[account(
        mut,
        seeds = [
            b"round",
            lottery.key.as_ref(),
            lottery.last_round.to_le_bytes().as_ref()
        ],
        bump = old_lottery_round.bump,
    )]
    pub old_lottery_round: Account<'info, LotteryRound>,

    /// The owner of the jungle
    #[account(mut)]
    pub payer: Signer<'info>,

    /// Clock account used to know the time
    pub clock: Sysvar<'info, Clock>,

    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}

/// Starts a new round of lottery
pub fn handler(ctx: Context<NewLotteryRound>, bump: u8) -> ProgramResult {
    let lottery = &mut ctx.accounts.lottery;
    if ctx.accounts.clock.unix_timestamp < lottery.last_timestamp + lottery.period as i64 {
        return Err(ErrorCode::TooSoonForNewRound.into());
    }

    let old_round = &mut ctx.accounts.old_lottery_round;
    old_round.winner = (ctx.accounts.clock.unix_timestamp % 8 + 1) as u64 as u8;

    // When there is no winners, transfers the pot to next round
    if old_round.spendings[(old_round.winner - 1) as usize] == 0 {
        lottery.unclaimed_pot += old_round.pot;
    }

    lottery.last_round += 1;
    lottery.last_timestamp += lottery.period as i64;

    let lottery_round = &mut ctx.accounts.lottery_round;
    lottery_round.bump = bump;
    lottery_round.index = lottery.last_round;
    lottery_round.start = lottery.last_timestamp;
    lottery_round.pot = ctx
        .accounts
        .escrow
        .try_lamports()?
        .checked_sub(lottery.unclaimed_pot)
        .or(Some(0_u64))
        .unwrap();

    lottery.unclaimed_pot = ctx.accounts.escrow.try_lamports()?;

    msg!("New round started");

    Ok(())
}
