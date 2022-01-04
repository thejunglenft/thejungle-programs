use anchor_lang::error;

#[error]
pub enum ErrorCode {
    #[msg("Trying to start a new round earlier than the period")]
    TooSoonForNewRound,

    #[msg("Too late to participate in this round")]
    RoundFinished,
    
    #[msg("The round is not finished yet")]
    RoundNotFinished,
}
