use anchor_lang::prelude::*;

use crate::Lottery;

#[derive(Accounts)]
pub struct SetLottery<'info> {
    /// The lottery
    #[account(
        mut,
        seeds = [
            b"lottery",
            lottery.key.as_ref()
        ],
        bump = lottery.bumps.lottery,
        has_one = owner
    )]
    pub lottery: Account<'info, Lottery>,

    /// The owner of the lottery
    #[account(mut)]
    pub owner: Signer<'info>,
}

/// Set a lottery
pub fn handler(
    ctx: Context<SetLottery>,
    start: i64,
    owner: Pubkey,
    mint: Pubkey,
    treasury: Pubkey,
    period: i64
) -> ProgramResult {
    let lottery = &mut ctx.accounts.lottery;
    lottery.owner = owner;
    lottery.mint = mint;
    lottery.treasury = treasury;
    lottery.period = period as u64;
    lottery.last_timestamp = start;

    msg!("Set lottery");

    Ok(())
}
