## Settings ##

List of available settings and a brief description

 - **fen**: {fen string}  
The FEN string for the starting position  
Will be overwritten by a FEN in the pgn  
(*ex. "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"*)

 - **size**: {enum: small, medium, large}  
The size of the replayer board (*ex. "small"*)

 - **lightColor**: {hex color}  
The desired color for the light squares (*ex. "#CCCCCC"*)

 - **darkColor**: {hex color}  
The desired color for the dark squares (*ex. "#999999"*)

 - **boardOnly**: {boolean}

 - **hideAnnotations**: {boolean}
 Set to true if you do not want to see the notes pane

 - **hideControls**: {boolean}
 Addition by Stack Exchange - hides the controls (useful if you are just setting up from a fen string)

 - **scrollOnEnd**: {boolean}  
Should additional mouse wheel scrolling when the game is at the start/end move the page?

 - **startFlipped**: {boolean}  
Should the board start flipped?  
If this is omitted and black is the first to move in the pgn, then it will flip by default