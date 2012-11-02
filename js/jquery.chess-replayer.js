/// <reference path="jquery-1.7.2-vsdoc.js" />

// ==ClosureCompiler==
// @output_file_name jquery.chess-replayer.min.js
// @warning_level VERBOSE
// @compilation_level ADVANCED_OPTIMIZATIONS
// @externs_url http://closure-compiler.googlecode.com/svn/trunk/contrib/externs/jquery-1.7.js
// ==/ClosureCompiler==

/**
*@license Chess Replayer 1.1.4
* Copyright (c) 2012 Andrew Hoy
* http://github.com/andrewphoy/chess-replayer
* MIT License
*/

/** @define {boolean} */
var DEBUG = true;

(function ($, window, document) {
    "use strict";

    var console_log = function (args) {
        if (DEBUG) {
            console.log(args);
        }
    };

    /**
    * @constructor
    */
    var Move = function (moveID, numberPattern, move, parentMoveID, comment, nag, ply) {
        this.moveID = moveID;
        this.numberPattern = numberPattern;
        this.move = move;
        this.parentMoveID = parentMoveID;
        this.comment = comment;
        this.nag = nag;
        this.ply = ply;

        this.transitions = [];

        this.children = [];

        this.nagToString = function (nag) {
            if (nag.charAt(0) == '$') {
                nag = nag.substring(1);
            }

            switch (parseInt(nag, 10)) {
                case 1:
                    return '!';

                case 2:
                    return '?';

                case 3:
                    return '!!';

                case 4:
                    return '??';

                case 5:
                    return '!?';

                case 6:
                    return '?!';

                case 7:
                case 8:
                    return '&#x25a1;';

                case 10:
                    return '=';

                case 13:
                    return '&infin;';

                case 14:
                    return '&#x2a72;';

                case 15:
                    return '&#x2a71;';

                case 16:
                    return '&plusmn;';

                case 17:
                    return '&#8723;';

                case 18:
                    return '&#43;&minus;';

                case 19:
                    return '&minus;&#43;';

                case 22:
                case 23:
                    return '&#x2a00;';

                case 32:
                case 33:
                    return '&#x27F3;';

                case 36:
                case 37:
                    return '&#x2192;';

                case 40:
                case 41:
                    return '&#x2191;';

                case 132:
                case 133:
                    return '&#x21c6;';

                case 140:
                    return '&#x2206;';

                case 142:
                    return '&#x2313;';

                case 145:
                    return 'RR';

                case 146:
                    return 'N';

                case 239:
                    return '&#x21d4;';

                case 240:
                    return '&#x21d7;';

                case 242:
                    return '&#x27eb;';

                case 243:
                    return '&#x27ea;';

                case 244:
                    return '&#x2715;';

                case 245:
                    return '&#x22a5;';

                default:
                    return '';

            }
        };

        this.printMove = function (includeMoveNumber) {
            var moveString = '';

            if (includeMoveNumber) {
                moveString += this.numberPattern + ' ';
            }

            moveString += this.move;

            // the move should look like 9. Nd5!! +-
            // no space between move and first NAG,
            // space between NAG's, however
            // include the move number (optionally)
            // NAG's go in ascending order

            if (this.nag) {
                var nags = this.nag.split(" ");
                moveString += this.nagToString(nags[0]);
                for (var i = 1; i < nags.length; i++) {
                    moveString += ' ' + this.nagToString(nags[i]);
                }
            }

            return moveString;
        };

        this.toString = function () {
            return this.printMove(false);
        };

        this.htmlMoveSpan = function (elemID, branchFactor, forceIncludeMoveNumber) {
            var includeMoveNumber = forceIncludeMoveNumber || (this.ply % 2 == 1) || this.parentMoveID == 0;
            var strHtml = strHtml = "<span id='" + elemID + "move" + this.moveID + "' class='move move" + branchFactor + "'>";
            strHtml += this.printMove(includeMoveNumber) + "</span>";
            return strHtml;
        };

    };

    /**
    * @constructor
    */
    var Replayer = function (elem, options) {
        this.elem = elem;

        // assign a unique id to the elem if it doesnt already have one
        // we cannot protect the user from duplicating an id, however
        if (!this.elem.id) {
            this.elem.id = "cr" + Math.random().toString(36).substring(5);
        }

        this.$elem = $(elem);

        this.options = options;
        this.metadata = this.$elem.data('replayer-options');

        // define a chess game class - this is only data for display, post-parse
        this.game = {
            // game meta data
            headers: [],
            result: '',

            // game state
            currentMoveID: 0,
            colorToMove: 1,
            enPassant: '',
            currentPly: 0,
            position: [],
            whiteKingPosition: -1,
            blackKingPosition: -1,
            hasAnnotations: false,

            // each move is an object, keyed by moveID
            moves: []
        };

        // define a board class - used after parsing
        this.board = {
            displayingVariationBox: false,
            modalNumOptions: 0,
            modalSelectedIndex: 0,
            direction: -1       // direction of the board.  -1 is standard, 1 is black perspective
        };
    };

    Replayer.prototype = {
        defaults: {
            "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",    // the fen string for the starting position
            "size": "small",     // supports small, medium, large
            "lightColor": "#CCCCCC",
            "darkColor": "#999999",
            "startPly": false,
            "boardOnly": false,
            "hideControls": false,
            "hideAnnotations": false,
            "showAnnotations": false,
            "scrollOnEnd": false,
            "startFlipped": false
        },

        size: {
            SMALL: 45,
            MEDIUM: 60,
            LARGE: 80
        },

        shift: {
            left: {
                SMALL: 13,
                MEDIUM: 21,
                LARGE: 31
            },
            top: {
                SMALL: 12,
                MEDIUM: 20,
                LARGE: 28
            }
        },

        regex: {
            // this is a regex for the allowable suffix of a move
            suffix: "((?:\\s*\\$\\d+)*)(\\s*\\{[^\\}]*\\})*",

            gameTermMarker: /(1-0|0-1|1\/2-1\/2|\*)$/g,

            commentLeftParen: /\{([^}]*?)(\()(.*?)\}/g,
            commentRightParen: /\{([^}]*?)(\))(.*?)\}/g,

            castleKingside: /^O-O/,
            castleQueenside: /^O-O-O/,

            pieceMove: /^([KQBNR])/,
            pieceDest: /(.*)([a-h])([1-8])/,
            pieceMoveFull: /^[KQBNR]([a-h])?([1-8])?x?[a-h][1-8]/,

            pawnMove: /^([a-h])([1-8])/,
            pawnCapture: /^([a-h])x([a-h])([1-8])/,
            pawnPromoSuffix: /=([QBNR])/
        },

        deltas: {
            rook: [-16, -1, 1, 16],
            knight: [-33, -31, -18, -14, 14, 18, 31, 33],
            bishop: [-17, -15, 15, 17],
            queen: [-17, -15, 15, 17, -16, -1, 1, 16],
            king: [-17, -16, -15, -1, 1, 15, 16, 17]
        },

        init: function () {
            this.userSettings = $.extend({}, this.options, this.metadata);
            this.settings = $.extend({}, this.defaults, this.options, this.metadata);

            this.cleanSettings();
            this.parseInput();          // parses 1) url (if given) 2) pgn (if available) 3) fen in that order
            this.printBoard();
            this.printMoves();          // displays the moves from the pgn in the moves pane
            this.addPieces();
            this.moveInitialPosition();   // also displays any comment and the last move
            this.addBindings();
        },

        addBindings: function () {
            var game = this;

            this.$elem.keydown(function (e) {
                if (e.which == 39) {
                    // right arrow
                    game.moveForward(false);
                    return false;

                } else if (e.which == 37) {
                    // left arrow
                    game.moveBackward(false);
                    return false;

                } else if (e.which == 40 && game.board.displayingVariationBox) {
                    // down arrow and showing modal popup
                    e.preventDefault();
                    game.modalDown();
                    return false;

                } else if (e.which == 38 && game.board.displayingVariationBox) {
                    // up arrow and showing modal popup
                    e.preventDefault();
                    game.modalUp();
                    return false;

                } else if (e.which == 70) {
                    // F key
                    game.flipBoard();
                    return false;

                } else if (e.which == 83 || e.which == 36 || e.which == 72) {
                    // S key or Home key or H key
                    game.moveStartPosition();
                    return false;

                } else if (e.which == 69) {
                    // E key
                    if (e.ctrlKey) {
                        game.moveEndPosition();
                    } else {
                        game.moveEndVariation();
                    }
                    return false;

                } else if (e.which == 35) {
                    // End key
                    if (e.ctrlKey) {
                        game.moveEndPosition();
                    } else {
                        game.moveEndVariation();
                    }
                    return false;

                } else if (e.which == 27) {
                    // Esc key
                    game.closeVariationBox();
                    return false;
                }

                return true;
            });

            $('.board,.moves', this.elem).bind('mousewheel DOMMouseScroll', function (e) {
                var wheelDelta = (-e.originalEvent.detail) || e.wheelDelta || e.originalEvent.wheelDelta;
                var handled = false;
                if (wheelDelta > 0) {
                    handled = game.moveBackward(false);
                }
                else {
                    handled = game.moveForward(false);
                }
                if (handled) {
                    e.preventDefault();
                }
                return !handled && game.settings["scrollOnEnd"];
            });

            $('.next', this.elem).click(function () {
                game.moveForward(false);
                return false;
            });

            $('.back', this.elem).click(function () {
                game.moveBackward(false);
                return false;
            });

            $('.start', this.elem).click(function () {
                game.moveStartPosition();
                return false;
            });

            $('.flip', this.elem).click(function () {
                game.flipBoard();
                return false;
            });

            $('.end', this.elem).click(function () {
                game.moveEndPosition();
                return false;
            });

            $('.move', this.elem).click(function () {
                var moveID = this.id.substring(game.elem.id.length + 4);
                if (moveID == '-end') {
                    game.moveEndPosition();
                } else {
                    game.moveToPosition(moveID);
                }
                return false;
            });
        },

        cleanSettings: function () {
            this.settings["size"] = this.settings["size"].toLowerCase();
            if (this.settings["size"] == "small") {
            } else if (this.settings["size"] == "large") {
            } else {
                this.settings["size"] = "medium";
            }
        },

        getShiftLeft: function () {
            if (this.settings["size"] == "small") {
                return this.shift.left.SMALL;
            } else if (this.settings["size"] == "large") {
                return this.shift.left.LARGE;
            } else {
                return this.shift.left.MEDIUM;
            }
        },

        getShiftTop: function () {
            if (this.settings["size"] == "small") {
                return this.shift.top.SMALL;
            } else if (this.settings["size"] == "large") {
                return this.shift.top.LARGE;
            } else {
                return this.shift.top.MEDIUM;
            }
        },

        boardElement: function () {
            return this.$elem.find('.board');
        },

        controlsElement: function () {
            return this.$elem.find('.controls');
        },

        movesElement: function () {
            return this.$elem.find('.moves');
        },

        notesElement: function () {
            return this.$elem.find('.notes');
        },

        setNotes: function (notes) {
            if (this.settings["boardOnly"] || this.settings["hideAnnotations"]) {
                return;
            }
            this.notesElement().html(notes);
        },

        squareSizePixels: function () {
            if (this.settings["size"] == "small") {
                return this.size.SMALL;
            } else if (this.settings["size"] == "large") {
                return this.size.LARGE;
            } else {
                return this.size.MEDIUM;
            }
        },

        printMoves: function () {
            if (this.settings["boardOnly"]) {
                return;
            }

            var totalWidth = this.$elem.width();
            var boardWidth = this.squareSizePixels() * 8;
            $('.moves', this.elem).width(totalWidth - boardWidth - 10); // subtract 10 for the scroll bar
            $('.moves', this.elem).height(boardWidth);

            var sbMoves = new Object();
            sbMoves.strings = [];

            this.printMove(0, sbMoves, 0, true, true);

            this.movesElement().html(sbMoves.strings.join(" "));
        },

        printMove: function (moveID, sb, branchFactor, suppressPrint, variationHead) {
            var move = this.game.moves[moveID];

            if (!suppressPrint) {
                sb.strings.push(move.htmlMoveSpan(this.elem.id, branchFactor, variationHead));
            }

            var childCount = move.children.length;

            if (childCount == 1) {
                this.printMove(move.children[0], sb, branchFactor, false, false);
            } else if (childCount == 0) {
                // print variation end
                if (branchFactor > 0) {
                    sb.strings.push(')');
                    if (branchFactor == 1) {
                        sb.strings.push('<br />');
                    }
                } else {
                    sb.strings.push("<span id='" + this.elem.id + "move-end' class='move move0'>" + this.game.result + "</span>");
                }

            } else {
                // multiple children
                // print the last child
                var lastChildID = move.children[move.children.length - 1];
                sb.strings.push(this.game.moves[lastChildID].htmlMoveSpan(this.elem.id, branchFactor, false));
                // print variation start
                if (branchFactor == 0) {
                    sb.strings.push('<br />');
                }
                // loop over all of the children except for the last one
                for (var i = 0; i < move.children.length - 1; i++) {
                    sb.strings.push('(');
                    // print move of the child
                    this.printMove(move.children[i], sb, branchFactor + 1, false, true);
                }

                // and finally print the last child (main line)
                this.printMove(lastChildID, sb, branchFactor, true, false);
            }

        },

        getHeader: function (key) {
            /// <summary>
            /// Returns a header from the game if it exists, null otherwise
            /// </summary>
            if (this.settings["headers"] == null) {
                return null;
            }

            var keyClean = key.toLowerCase();
            if (this.settings["headers"].hasOwnProperty(keyClean)) {
                return this.settings["headers"][keyClean];
            } else {
                return null;
            }
        },

        parseInput: function () {
            // get the contents of the target div
            var content = $.trim(this.$elem.html());

            //TODO do something smart with the content
            this.settings["pgn"] = content;

            if (this.settings["url"]) {
                this.parseUrl();
            }
            if (this.settings["pgn"]) {
                this.parsePgn();
            }

            // now parse the fen (in order to have the initial display)
            this.parseFEN();
        },

        validateFEN: function (fen) {
            var pattern = /\s*([rnbqkpRNBQKP1-8]+\/){7}([rnbqkpRNBQKP1-8]+)\s[bw-]\s(([a-hkqA-HKQ]{1,4})|(-))\s(([a-h][36])|(-))\s\d+\s\d+\s*/;
            return pattern.test(fen);
        },

        parseUrl: function () {

        },

        parsePgn: function () {
            /// <summary>
            /// Called if there is a pgn
            /// &#10;The resolved pgn can optionally set the start FEN to something other than the default using the FEN header
            /// </summary>

            var pgn = this.settings["pgn"];

            // handle any headers in the pgn
            if (pgn.charAt(0) == '[') {
                // if we start with a bracket, we assume there are headers
                var parts = pgn.split("\n\n");

                if (parts.length != 2) {
                    console_log('Invalid pgn, must have only header and body');
                } else {
                    var re = /\[([\w\d]+)\s+"(.*?)"/g;
                    var match;
                    var headers = {};

                    while (match = re.exec(parts[0])) {
                        headers[match[1].toLowerCase()] = match[2];
                    }

                    this.settings["headers"] = headers;
                    // remove the headers before we continue
                    pgn = parts[1];

                    // if we have a fen, set this.settings["fen"]
                    var headerFen = this.getHeader('fen');
                    if (headerFen != null) {
                        if (this.validateFEN(headerFen)) {
                            this.settings["fen"] = headerFen;
                        }
                    }
                }
            }

            var pgnBody = pgn;
            var dt = this.prepareMoveTable();

            // the pgn spec (http://www.saremba.de/chessgml/standards/pgn/pgn-complete.htm)
            // allows for end of line comments starting with ";" and escaping with "%"
            // we just ignore that as no major software emits pgn with this type of comment

            // replace any line breaks with a space
            pgnBody = pgnBody.replace(/(\r\n|\n|\r)/gm, " ");

            // protect any parens in comments
            pgnBody = pgnBody.replace(this.regex.commentLeftParen, "{$1&lpar;$3}");
            pgnBody = pgnBody.replace(this.regex.commentRightParen, "{$1&rpar;$3}");

            // label the variations, hybrid between state machine and regex parsing
            pgnBody = this.labelVariations(pgnBody);

            // replace parens
            pgnBody = pgnBody.replace("&lpar;", "(");
            pgnBody = pgnBody.replace("&rpar;", ")");

            // try to get the result of the game
            var gameTermMarker = this.regex.gameTermMarker.exec(pgnBody);
            if (gameTermMarker != null && gameTermMarker.length >= 2) {
                this.game.result = gameTermMarker[1];
            }

            // now extract all of the moves from the pgn
            // figure out what the first move ply is
            var firstPly = -1;

            // get the first number match in the pgn
            var firstMoveMatch = /(\d+)(\.+)/.exec(pgnBody);
            if (firstMoveMatch != null) {
                var ply = firstMoveMatch[1] * 2;
                if (firstMoveMatch[2] == '.') {
                    ply = ply - 1;
                }
                firstPly = ply;
            }

            if (firstPly > 0) {
                this.extractMoves(dt, 0, firstPly, pgnBody);
            }

            // dt now holds all of the moves from the pgn - which we assume has no errors
            this.game.moves = dt.array;
        },

        prepareMoveTable: function () {
            //TODO change moves to be short var names and strings
            // this is necessary in order to have serialization/deserialization work correctly
            // even across multiple compilations with drastic changes
            var dt = new Object();
            dt.array = [];
            dt.currentMoveID = 0;
            dt.array[0] = new Move(0, null, null, -1, '', null, null);
            return dt;
        },

        labelVariations: function (pgnBody) {
            var i = 0;
            var hasVariations = true;
            var pattern = /\(([^(]*?)\)/g;

            while (hasVariations) {
                if (pgnBody.match(pattern)) {
                    pgnBody = pgnBody.replace(pattern, "%%" + i + "% $1 %" + i + "%%");
                }

                hasVariations = false;
                if (pgnBody.match(pattern)) {
                    hasVariations = true;
                    i = i + 1;
                }
            }

            return pgnBody;
        },

        extractMoves: function (dt, parentID, ply, pgn) {
            // get the number pattern (ply 1 = 1., ply 2 = 1..., etc.)
            var numberPattern = this.patternForPly(ply);

            // process all variations for this particular ply
            var variationPattern = "%%(\\d+)%\\s*" + numberPattern + "\\s*(\\w\\S+)" + this.regex.suffix + "(?:\\s+(.*?))?%\\1%%";
            var variationRegex = new RegExp(variationPattern, "g");

            var result;
            var move;
            var line;

            while ((result = variationRegex.exec(pgn)) !== null) {
                move = $.trim(result[2]);

                var comment = "";
                var nag = "";
                if (result[3]) { nag = $.trim(result[3]); }
                if (result[4]) {
                    comment = $.trim(result[4]);
                    while (comment.charAt(0) === '{') {
                        comment = comment.substr(1);
                    }
                    while (comment.charAt(comment.length - 1) === '}') {
                        comment = comment.slice(0, -1);
                    }
                    if (comment.length > 0) {
                        this.game.hasAnnotations = true;
                    }
                }

                dt.currentMoveID++;
                dt.array[dt.currentMoveID] = new Move(
                    dt.currentMoveID,
                    numberPattern.replace(/\\/g, ""),
                    move,
                    parentID,
                    comment,
                    nag,
                    ply
                );
                dt.array[parentID].children.push(dt.currentMoveID);

                line = result[5];
                if (line != null) {
                    line = $.trim(line);
                    if (line.length > 0 && isNaN(line.charAt(0))) {
                        // if there are remaining moves and the first char is not a move number
                        line = this.patternForPly(ply + 1).replace(/\\/g, "") + " " + line;
                    }
                    // move a level deeper within the variation
                    this.extractMoves(dt, dt.currentMoveID, ply + 1, line);
                }

            }

            // remove the variations from the pgn
            pgn = pgn.replace(variationRegex, "");

            // now process the main line
            var mainPattern = "(?:^|\\s+)" + numberPattern + "\\s*(\\w\\S+)" + this.regex.suffix + "(?:\\s+(.*)|($))";
            var mainRegex = new RegExp(mainPattern, "m");

            result = mainRegex.exec(pgn);
            if (result != null) {
                move = $.trim(result[1]);

                // get comments and nags
                var comment = "";
                var nag = "";
                if (result[2]) { nag = $.trim(result[2]); }
                if (result[3]) {
                    comment = $.trim(result[3]);
                    while (comment.charAt(0) === '{') {
                        comment = comment.substr(1);
                    }
                    while (comment.charAt(comment.length - 1) === '}') {
                        comment = comment.slice(0, -1);
                    }
                    if (comment.length > 0) {
                        this.game.hasAnnotations = true;
                    }
                }

                // save the move in the table
                dt.currentMoveID++;
                dt.array[dt.currentMoveID] = new Move(
                    dt.currentMoveID,
                    numberPattern.replace(/\\/g, ""),
                    move,
                    parentID,
                    comment,
                    nag,
                    ply
                );
                dt.array[parentID].children.push(dt.currentMoveID);

                line = result[4];
                if (line != null) {
                    line = $.trim(line);
                    if (line.length > 0 && isNaN(line.charAt(0))) {
                        // if there are remaining moves and the first char is not a move number
                        line = this.patternForPly(ply + 1).replace(/\\/g, "") + " " + line;
                    }
                    // move a level deeper
                    this.extractMoves(dt, dt.currentMoveID, ply + 1, line);
                }
            }
        },

        patternForPly: function (ply) {
            var moveNumber = Math.ceil(ply / 2);
            var movePattern = moveNumber.toString();
            var period = "\\.";
            if (ply % 2 == 0) {
                period = "\\.\\.\\.";
            }
            movePattern = movePattern + period;
            return movePattern;
        },

        parseFEN: function () {
            /// <summary>
            /// Called at game load time
            /// &#10;Runs every time, parses the start position FEN into a [0x88] position array
            /// </summary>

            if (!this.validateFEN(this.settings["fen"])) {
                console_log('invalid fen - cannot continue');
                return;
            }

            var dataGroups = this.settings["fen"].split(" ");
            var rows = dataGroups[0].split("/");

            //var squares = [];
            var offset = 112;
            var ixChar = 0;

            for (var col = 0; col < 8; col++) {
                ixChar = 0;
                for (var i = 0; i < 8; i++) {
                    var charNext = rows[col].charAt(ixChar);
                    if (charNext != null && isNaN(charNext)) {
                        // is a piece
                        var color = (charNext.toLowerCase() == charNext) ? 'b' : 'w';
                        this.game.position[offset + i] = color + charNext.toLowerCase();
                        // is it a king?
                        if (charNext.toLowerCase() == 'k') {
                            if (color == 'w') {
                                this.game.whiteKingPosition = offset + i;
                            } else {
                                this.game.blackKingPosition = offset + i;
                            }
                        }
                    } else {
                        // is an empty square
                        i += ((+charNext) - 1);
                    }
                    ixChar++;
                }
                offset -= 16;
            }

            if (dataGroups[1] == 'b') {
                this.game.colorToMove = -1;
            }

            //TODO parse the rest of the FEN string
            // this will only become important when we allow users to enter moves directly
            // ["5rk1/p4p2/1p2r2p/2p2Rp1/3b2P1/1P1P3P/P1PR3B/7K", "b", "-", "-", "0", "1"] 
            // 0) position
            // 1) colorToMove
            // 2) castling avail
            // 3) en passant file
            // 4) halfmove clock
            // 5) fullmove number
        },

        printBoard: function () {
            /// <summary>
            /// Called at game load time
            /// &#10;Runs every time, creates the DOM elements needed for display
            /// </summary>

            this.$elem.empty();

            this.$elem.attr("tabindex", -1);

            if (this.boardElement().size() == 0) {
                this.$elem.append('<div class="board"></div>').css({ position: 'relative' });
            }

            if (!this.settings["boardOnly"]) {
                if (this.movesElement().size() == 0) {
                    this.$elem.append('<div class="moves"></div>');
                }
            }


            if (!this.settings["hideControls"]) {
                if (this.controlsElement().size() == 0) {
                    this.$elem.append('<div class="controls"></div>');
                }
            }

            if (!this.settings["boardOnly"] && !this.settings["hideAnnotations"]) {
                if (this.notesElement().size() == 0 && (this.game.hasAnnotations || this.settings["showAnnotations"])) {
                    this.$elem.append('<div class="notes"></div>');
                }
            }

            var divBoard = this.boardElement();

            var size = this.squareSizePixels();
            var lightColor = this.settings["lightColor"];
            var darkColor = this.settings["darkColor"];
            var color;

            var brdStr = "";
            brdStr += "<table class='chess-replayer-board'>";
            for (var row = 7; row >= 0; row--) {
                brdStr += "<tr>";
                for (var col = 0; col <= 7; col++) {
                    color = (col + row) % 2 == 0 ? darkColor : lightColor;
                    brdStr += "<td style='min-width: " + size + "px; width: " + size + "px; min-height: " + size + "px; height: " + size + "px; background-color: " + color + ";'>"
                            + "</td>";
                }
                brdStr += "</tr>";
            }
            brdStr += "</table>";

            this.$elem.addClass("chess-replayer");

            divBoard.html(brdStr);

            var divControls = this.controlsElement();
            var cntrlStr = '<a class="start button" href="#">|< Start</a><a class="back button" href="#"><< Back</a><a class="flip button" href="#">Flip</a><a class="next button" href="#">Next >></a><a class="end button" href="#">End >|</a>';
            divControls.html(cntrlStr);
        },

        addPieces: function () {
            /// <summary>
            /// Called at game load time
            /// &#10;Adds the pieces from the initial FEN position to the board
            /// &#10;Additional pieces (from queening, etc.) will be added when making the moves
            /// </summary>

            var size = this.squareSizePixels();
            var divBoard = this.boardElement();

            var shiftLeft = this.getShiftLeft();
            var shiftTop = this.getShiftTop();

            // add the individual pieces
            for (var row = 7; row >= 0; row--) {
                for (var col = 0; col <= 7; col++) {
                    var id = row * 16 + col;
                    var piece = this.game.position[id];
                    if (piece != null) {
                        var pieceDivId = this.elem.id + id;
                        divBoard.append("<div id='" + pieceDivId + "' class='" + piece + "-" + this.settings["size"] + " chess-piece'></div>");

                        var posTop = size * (7 - row) + shiftTop;
                        var posLeft = size * col + shiftLeft;

                        $('#' + pieceDivId).css({ position: 'absolute', top: posTop, left: posLeft, height: size + 'px', width: size + 'px' });
                    }
                }
            }
        },

        flipBoard: function () {
            var size = this.squareSizePixels();
            var divBoard = this.boardElement();
            var flipLength = size * 7;

            var shiftLeft = this.getShiftLeft();
            var shiftTop = this.getShiftTop();

            var curTop;
            var curLeft;
            var newTop;
            var newLeft;

            var game = this;

            // check to see if animations are currently running
            var animationCheck = setInterval(function () {
                if (!$('.chess-piece', divBoard).is(":animated")) {
                    clearInterval(animationCheck);

                    // once the animations are done, flip the board
                    divBoard.children('.chess-piece').each(function () {
                        curTop = parseInt($(this).css('top'), 10) - shiftTop;
                        curLeft = parseInt($(this).css('left'), 10) - shiftLeft;

                        newLeft = (flipLength - curLeft) + shiftLeft;
                        newTop = (flipLength - curTop) + shiftTop;

                        $(this).css({ position: 'absolute', top: newTop, left: newLeft });
                    });

                    game.board.direction *= -1;
                }
            }, 100);
        },

        moveInitialPosition: function () {
            /// <summary>
            /// Called at game load time
            /// &#10;Moves to the initial position and inserts the appropriate move text
            /// &#10;The initial position is not necessarily the chess starting position
            /// </summary>

            // do we want to flip the board?
            var needsFlipping = false;
            if (this.settings["startFlipped"]) {
                needsFlipping = true;
            }

            // if we did not explicitly say 'no flip' and black is the first to move, flip
            if (!("startFlipped" in this.userSettings)) {
                if (this.game.colorToMove == -1) {
                    needsFlipping = true;
                }

                // if we have a pgn tag StartFlipped, use that instead
                var headerFlipped = this.getHeader("StartFlipped");
                if (headerFlipped != null) {
                    if (headerFlipped.toLowerCase() == 'true' || headerFlipped == '1') {
                        needsFlipping = true;
                    } else {
                        needsFlipping = false;
                    }
                }
            }

            // if we have a header StartPly or a setting startPly, advance to that ply (or the end of the game, whichever comes first)
            var startPly = 0;
            if ("startPly" in this.userSettings) {
                // the html/js always overrides the pgn
                var x = parseInt(this.userSettings["startPly"], 10);
                if (x != null && x > 0) {
                    startPly = x;
                }
            } else {
                var x = parseInt(this.getHeader("StartPly"), 10);
                if (x != null && x > 0) {
                    startPly = x;
                }
            }

            if (needsFlipping) {
                this.flipBoard();
            }

            if (startPly > 0) {
                // get the first ply of the initial move
                var rootMove = this.game.moves[0];
                var firstMoveID = rootMove.children[rootMove.children.length - 1];
                var firstPly = this.game.moves[firstMoveID].ply;

                if (firstPly < startPly) {
                    // can't start before the first move

                    // we shouldn't have a game longer than 250 moves
                    // if it is, please give us a starting position...
                    var counter = 0;
                    var currPly = 0;
                    var move = rootMove;
                    while (move != null && move.children.length > 0 && currPly < startPly && counter < 500) {
                        // make the last child move
                        var lastChildID = move.children[move.children.length - 1];
                        this.execMoveForward(lastChildID, true);
                        move = this.game.moves[lastChildID];
                        currPly = move.ply;
                    }
                }
            }
        },

        moveStartPosition: function () {
            while (this.game.currentPly > 0) {
                this.moveBackward(true);
            }
        },

        moveToPosition: function (targetMoveID) {
            targetMoveID = parseInt(targetMoveID, 10);
            if (targetMoveID == null) {
                return;
            }

            if (targetMoveID == this.game.currentMoveID) {
                return;
            }

            // construct the path from the currentMoveID to the root
            var currentStack = [this.game.currentMoveID];
            var move = this.game.moves[this.game.currentMoveID];
            while (move.parentMoveID >= 0) {
                currentStack.unshift(move.parentMoveID);
                move = this.game.moves[move.parentMoveID];
            }

            // construct the path from the targetMoveID to the root
            var targetStack = [targetMoveID];
            move = this.game.moves[targetMoveID];
            while (move.parentMoveID >= 0) {
                targetStack.unshift(move.parentMoveID);
                move = this.game.moves[move.parentMoveID];
            }

            // now find the first difference in the stacks
            var commonAncestor = 0;
            var minHeight = Math.min(currentStack.length, targetStack.length);
            for (var i = 0; i < minHeight; i++) {
                if (currentStack[i] != targetStack[i]) {
                    break;
                }
                commonAncestor = currentStack[i];
            }

            // now we have the common ancestor
            // go back to the common ancestor from the current node
            while (this.game.currentMoveID > commonAncestor) {
                this.moveBackward(true);
            }

            // are we there now?
            if (this.game.currentMoveID == targetMoveID) {
                return;
            }

            // now move forward along the targetStack until we get to the targetMoveID
            while (this.game.currentMoveID < targetMoveID) {
                this.execMoveForward(targetStack[i], true);
                i++;
            }
        },

        moveEndPosition: function () {
            this.moveToPosition(this.game.moves.length - 1);
        },

        moveEndVariation: function () {
            var move = this.game.moves[this.game.currentMoveID];
            while (move != null && move.children.length > 0) {
                // make the last child move
                var lastChildID = move.children[move.children.length - 1];
                this.execMoveForward(lastChildID, true);
                move = this.game.moves[lastChildID];
            }
        },

        moveForward: function (instant) {
            var lastMove = this.game.moves[this.game.currentMoveID];

            if (lastMove.children.length == 0) {
                // cannot move forward, at the end of the line
                return false;
            }

            if (lastMove.children.length == 1 || this.board.displayingVariationBox) {
                var moveID = lastMove.children[lastMove.children.length - 1];

                if (this.board.displayingVariationBox) {
                    moveID = lastMove.children[this.board.modalSelectedIndex];
                    this.closeVariationBox();
                }
                this.execMoveForward(moveID, instant);
                return true;

            } else {
                // show a modal popup box to choose the variation
                this.displayVariationBox(lastMove);
                return true;
            }
        },

        closeVariationBox: function () {
            if (this.board.displayingVariationBox) {
                this.board.displayingVariationBox = false;
                $('.modal li', this.elem).unbind('click');
                $('.modal', this.elem).remove();
                this.$elem.focus();
            }
        },

        displayVariationBox: function (parentMove) {
            // see also http://jsfiddle.net/9UnKT/5/
            // append the html to the board element
            var id = this.elem.id + 'modal';

            var numChoices = parentMove.children.length;

            var html = '';
            html = '<div class="modal"><ul>';
            for (var i = numChoices - 1; i >= 0; i--) {
                html += '<li class="' + i + '">' + this.game.moves[parentMove.children[i]].printMove(true) + '</li>';
            }
            html += '</ul></div>';
            this.boardElement().append(html);

            // now decide on style for the element
            var leftPos = this.squareSizePixels() * 8;
            $('.modal', this.elem).css({
                top: 10,
                left: leftPos + 20
            });

            var game = this;
            $('.modal li', this.elem).click(function (e) {
                var idx = parseInt($(e.target).attr('class'), 10);
                game.board.modalSelectedIndex = idx;
                game.moveForward(false);
            });

            this.board.displayingVariationBox = true;
            this.board.modalSelectedIndex = numChoices - 1;
            this.board.modalNumOptions = numChoices;

            $('.modal .' + this.board.modalSelectedIndex, this.elem).toggleClass('selected');
        },

        modalUp: function () {
            if (this.board.modalSelectedIndex + 1 >= this.board.modalNumOptions) {
                return;
            }
            this.board.modalSelectedIndex++;
            $('.modal .selected', this.elem).toggleClass('selected');
            $("." + this.board.modalSelectedIndex, '.modal').toggleClass('selected');
        },

        modalDown: function () {
            if (this.board.modalSelectedIndex <= 0) {
                return;
            }
            this.board.modalSelectedIndex--;
            $('.modal .selected', this.elem).toggleClass('selected');
            $("." + this.board.modalSelectedIndex, '.modal').toggleClass('selected');
        },

        execMoveForward: function (moveID, instant) {
            if (moveID != null) {

                var move = this.game.moves[moveID];

                // now display any comments and the move
                this.selectMove(move);

                // now execute the animations for the targetMove
                this.executeMove(move, 1, instant);

                // and finally, update the game state
                this.game.currentPly++;
                this.game.currentMoveID = moveID;
                this.game.colorToMove *= -1;
            }
        },

        moveBackward: function (instant) {
            if (this.board.displayingVariationBox) {
                // close the variation popup because we are moving backward
                this.closeVariationBox();
                return true;
            }

            if (this.game.currentPly > 0) {
                var lastMove = this.game.moves[this.game.currentMoveID];
                var parentMoveID = lastMove.parentMoveID;

                // display the last moves comments
                this.selectMove(this.game.moves[parentMoveID]);
                //this.setNotes(this.game.moves[parentMoveID].comment);

                // execute the reverse transitions
                this.executeMove(lastMove, -1, instant);

                // and finally, update the game state
                this.game.currentPly--;
                this.game.currentMoveID = parentMoveID;
                this.game.colorToMove *= -1;
                return true;
            } else {
                return false;
            }
        },

        selectMove: function (move) {
            this.setNotes(move.comment);
            // turn off the existing highlighted move
            $('.active', this.elem).toggleClass('active');
            var $moveSpan = $('#' + this.elem.id + 'move' + move.moveID.toString());
            $moveSpan.toggleClass('active');

            if (move.moveID > 0 && !this.settings["boardOnly"]) {
                var movePositionTop = $moveSpan.position().top;
                var moveHeight = $moveSpan.height();

                if (movePositionTop < moveHeight) {
                    var moveUpDelta = moveHeight - movePositionTop;
                    var curScrollTop = this.movesElement().scrollTop();
                    if (curScrollTop > moveUpDelta) {
                        this.movesElement().scrollTop(curScrollTop - moveUpDelta);
                    } else {
                        if (curScrollTop > 0) {
                            this.movesElement().scrollTop(0);
                        }
                    }
                }
                if ((movePositionTop + moveHeight) > this.movesElement().height()) {
                    var moveDownDelta = movePositionTop + moveHeight - this.movesElement().height();
                    this.movesElement().scrollTop(this.movesElement().scrollTop() + moveDownDelta);
                }
            }
        },

        isSliding: function (piece) {
            return (piece == 'Q' || piece == 'R' || piece == 'B');
        },

        getDeltas: function (piece) {
            switch (piece) {
                case 'Q':
                    return this.deltas.queen;

                case 'R':
                    return this.deltas.rook;

                case 'B':
                    return this.deltas.bishop;

                case 'N':
                    return this.deltas.knight;

                case 'K':
                    return this.deltas.king;
            }
        },

        findOrigins: function (piece, start) {
            var isSliding = this.isSliding(piece);
            var deltas = this.getDeltas(piece);

            var startPiece = (this.game.colorToMove == 1 ? 'w' : 'b') + piece.toLowerCase();
            var possibles = [];

            var ixDest;
            var delta;

            for (var i = 0; i < deltas.length; i++) {
                delta = deltas[i];
                ixDest = start + delta;

                // loop while the square is on the board
                while (!(ixDest & 0x88)) {
                    // check if the square is occupied
                    if (this.game.position[ixDest] != null) {
                        if (this.game.position[ixDest] == startPiece) {
                            possibles.push(ixDest);
                        }
                        break;
                    }

                    ixDest += delta;

                    if (!isSliding) {
                        break;
                    }
                }
            }

            return possibles;
        },

        generateTransitions: function (move) {
            // generate the transitions for the given move from the current position
            // does NOT make the transitions on the board - only figures out what they are

            // first check castling
            // queenside first because of regex considerations
            if (this.regex.castleQueenside.test(move.move)) {
                var rank = (this.game.colorToMove == 1) ? 0 : 7;
                var kstart = rank * 16 + 4;
                var rstart = rank * 16;
                return [
                    "m:" + kstart.toString() + ":" + (kstart - 2).toString(),
                    "m:" + rstart.toString() + ":" + (rstart + 3).toString()
                ];
            }

            // now kingside castling
            if (this.regex.castleKingside.test(move.move)) {
                var rank = (this.game.colorToMove == 1) ? 0 : 7;
                var kstart = rank * 16 + 4;
                var rstart = rank * 16 + 7;
                return [
                    "m:" + kstart.toString() + ":" + (kstart + 2).toString(),
                    "m:" + rstart.toString() + ":" + (rstart - 2).toString()
                ];
            }

            // was the move a piece? (pawns are down further in the else case, keep reading!)
            if (this.regex.pieceMove.test(move.move)) {
                var piece = this.regex.pieceMove.exec(move.move)[0];

                // find the destination square
                // the destination will always be at the end because a piece cannot promote
                // this will strip off any nags (we have already removed comments, so only literals are left !, +, #, etc.)
                var dest = this.regex.pieceDest.exec(move.move);
                var trank = dest[3] - 1;
                var tfile = dest[2].toLowerCase().charCodeAt(0) - 97;
                var ixEndSquare = 16 * trank + tfile;

                // we now know the piece and the to-square
                var possibleOrigins = this.findOrigins(piece, ixEndSquare);

                // actually figure out where the piece came from - we will factor in legality and disambiguity
                var transitions = [];
                if (possibleOrigins.length == 1) {
                    // simple case, just one move
                    transitions = ['m:' + possibleOrigins[0] + ':' + ixEndSquare];

                } else {
                    // there are two ways that multiple moves can be pruned:
                    //  1) disambiguation (ex. Rad1, N5c3, Na1c2)
                    //  2) legality (ex. Ne2 is pinned so Nc3 can only be Nb1-c3)

                    // can we use disambiguation?
                    var pieceMoveFull = this.regex.pieceMoveFull.exec(move.move);

                    // IE8 specific bug - must also check for not empty string
                    if (pieceMoveFull[1] != null && pieceMoveFull[1] != '') {
                        // we have a file given
                        var filePossibles = [];

                        var sfile = pieceMoveFull[1].toLowerCase().charCodeAt(0) - 97;

                        for (var i = 0; i < possibleOrigins.length; i++) {
                            if (possibleOrigins[i] % 16 == sfile) {
                                filePossibles.push(possibleOrigins[i]);
                            }
                        }

                        possibleOrigins = filePossibles;
                    }

                    if (pieceMoveFull[2] != null && pieceMoveFull[2] != '') {
                        // we have rank given
                        var rankPossibles = [];

                        var srank = pieceMoveFull[2] - 1;

                        for (var i = 0; i < possibleOrigins.length; i++) {
                            if (Math.floor(possibleOrigins[i] / 16) == srank) {
                                rankPossibles.push(possibleOrigins[i]);
                            }
                        }

                        possibleOrigins = rankPossibles;
                    }

                    if (possibleOrigins.length == 1) {
                        transitions = ['m:' + possibleOrigins[0] + ':' + ixEndSquare];
                    } else {
                        // check to see if one (or more) of the possibilities can be removed due to pins
                        var pinnedPossibles = [];
                        var ixKing = (this.game.colorToMove == 1) ? this.game.whiteKingPosition : this.game.blackKingPosition;

                        for (var i = 0; i < possibleOrigins.length; i++) {
                            if (!this.isPinned(possibleOrigins[i], ixKing)) {
                                pinnedPossibles.push(possibleOrigins[i]);
                            }

                        }

                        if (pinnedPossibles.length == 1) {
                            transitions = ['m:' + pinnedPossibles[0] + ':' + ixEndSquare];
                        } else {
                            console_log('multiple possible moves, not yet implemented');
                        }
                    }

                }

                // and finally, was it a capture? (hint: remove transition must be first!)
                if (this.game.position[ixEndSquare] != null) {
                    transitions.splice(0, 0, 'r:' + ixEndSquare + ':' + this.game.position[ixEndSquare].toString());
                }

                return transitions;

                // end of piece move logic

            } else {
                // since the move wasn't a piece move, it was a pawn move
                var trank = null;
                var tfile = null;
                var startSquare = null;
                var transitions = [];
                var movingColor = this.game.colorToMove == 1 ? 'w' : 'b';

                // was it just a simple pawn move?
                if (this.regex.pawnMove.test(move.move)) {
                    var matches = this.regex.pawnMove.exec(move.move);

                    tfile = matches[1].toLowerCase().charCodeAt(0) - 97; // minus 96 for ASCII, minus 1 for 0-based index
                    trank = matches[2] - 1; // minus one for zero based index

                    // find the start square for the pawn
                    // did we move forward one square?
                    var minusOneRank = trank - (1 * this.game.colorToMove);
                    var minusOneStartSquare = minusOneRank * 16 + tfile;

                    if (this.game.position[minusOneStartSquare] == (movingColor + 'p')) {
                        // yes, we moved forward one square!
                        startSquare = minusOneStartSquare;
                        //TODO check if it was a legal move
                        transitions = ['m:' + minusOneStartSquare + ':' + (trank * 16 + tfile).toString()];

                    } else {
                        // in order to move forward 2, we must start on the 2nd (7th) and move to the 4th (5th)
                        // additionally, 2nd (7th) must be a pawn, and 3rd (6th) must be empty
                        if (this.game.colorToMove == 1) {
                            // white is moving
                            if (
                                trank == 3 &&
                                this.game.position[(16 + tfile)] == 'wp' &&
                                this.game.position[(32 + tfile)] == null
                            ) {
                                //TODO check if it was a legal move
                                transitions = [
                                    'm:' + (16 + tfile).toString() + ':' + (48 + tfile).toString(),
                                    'e:' + tfile.toString()
                                ];
                                // return early because we can't queen on the first move
                                return transitions;
                            }

                        } else {
                            // black is moving
                            if (
                                trank == 4 &&
                                this.game.position[(96 + tfile)] == 'bp' &&
                                this.game.position[(80 + tfile)] == null
                            ) {
                                //TODO check if it was a legal move
                                transitions = [
                                    'm:' + (96 + tfile).toString() + ':' + (64 + tfile).toString(),
                                    'e:' + tfile.toString()
                                ];
                                // return early because we can't queen on the first move
                                return transitions;
                            }
                        }

                        // error
                        console_log("[Replayer][Error] Error parsing pawn move - I thought it was a regular pawn move, but there is no pawn that can move here");
                        return [];

                    }

                    // how about a capture?
                } else if (this.regex.pawnCapture.test(move.move)) {
                    var matches = this.regex.pawnCapture.exec(move.move);

                    // we know where the pawn was going...
                    tfile = matches[2].toLowerCase().charCodeAt(0) - 97; // minus 96 for ASCII, minus 1 for 0-based index
                    trank = matches[3] - 1;

                    // now figure out where the pawn started
                    var ffile = matches[1].toLowerCase().charCodeAt(0) - 97; // minus 96 for ASCII, minus 1 for 0-based index
                    var minusOneRank = trank - (1 * this.game.colorToMove);

                    // was it an en passant capture?
                    if (this.game.enPassant == tfile) {
                        // we are on the correct file, now we need to check to see if we're moving to the proper square
                        var remSquare = null;

                        if (this.game.colorToMove == 1 && trank == 5) {
                            remSquare = 64 + tfile;
                        }

                        // are we black?
                        if (this.game.colorToMove == -1 && trank == 2) {
                            remSquare = 48 + tfile;
                        }

                        if (remSquare != null) {
                            var remPiece = this.game.position[remSquare];
                            // return early because we can't queen on an en passant capture
                            return [
                                'r:' + remSquare.toString() + ':' + remPiece,
                                'm:' + (minusOneRank * 16 + ffile).toString() + ':' + (trank * 16 + tfile).toString()
                            ];
                        }

                    }

                    // regular capture, remove the piece at the to square and make the move
                    startSquare = minusOneRank * 16 + ffile;
                    transitions = [
                        'r:' + (trank * 16 + tfile).toString() + ':' + this.game.position[(trank * 16 + tfile)],
                        'm:' + (minusOneRank * 16 + ffile).toString() + ':' + (trank * 16 + tfile).toString()
                    ];

                } else {
                    // we shouldn't ever get here
                    console_log("[Replayer][Error] Unknown move type");
                    console_log(move);
                }

                // finally, check to see if we queened
                if (this.regex.pawnPromoSuffix.test(move.move)) {
                    var promoPiece = this.regex.pawnPromoSuffix.exec(move.move)[1];
                    var colorOnMove = (this.game.colorToMove == 1) ? 'w' : 'b';
                    var strToSquare = (trank * 16 + tfile).toString();

                    // we will replace the 'move' transition with a 'promo' transition
                    // first remove the existing move transition
                    var newTransitions = [];
                    for (var i = 0; i < transitions.length; i++) {
                        var pieces = transitions[i].split(':');
                        if (pieces[0] != 'm') {
                            newTransitions.push(transitions[i]);
                        }
                    }
                    // now insert a promotion transition
                    newTransitions.push('p:' + strToSquare + ':' + startSquare.toString() + ':' + colorOnMove + ':' + promoPiece.toLowerCase());
                    transitions = newTransitions;
                }

                return transitions;
            }
        },

        isPinned: function (ixPiece, ixKing) {
            var toKingDelta = ixPiece - ixKing;
            var absKingDelta = Math.abs(toKingDelta);
            var delta = null;

            if (absKingDelta > 0 && absKingDelta < 7) {
                // moving left or right
                delta = 1;
            } else if (absKingDelta % 15 == 0) {
                // moving north west
                delta = 15;
            } else if (absKingDelta % 16 == 0) {
                // moving north
                delta = 16;
            } else if (absKingDelta % 17 == 0) {
                // moving north east
                delta = 17;
            }

            if (delta !== null) {
                // we have a potential pinning situation
                var absDelta = delta;

                if (toKingDelta < 0) {
                    delta = delta * -1;
                }

                // start from the king's position + delta
                var ixSquare = ixKing + delta;
                var foundSelf = false;

                // loop while we are still on the board
                while (!(ixSquare & 0x88)) {
                    // check if the square is occupied
                    if (this.game.position[ixSquare] != null) {
                        // if we have not found the initial piece, then we don't have a pin
                        if (ixSquare == ixPiece) {
                            foundSelf = true;
                        } else if (!foundSelf) {
                            return false;
                        } else {
                            // we have already found self
                            // is it a pinning piece?
                            // must be opposite color of colorToMove and a sliding piece in the correct orientation
                            var pinner = this.game.position[ixSquare];
                            var pinPiece = pinner.charAt(1);
                            var pinColor = pinner.charAt(0);
                            var colorNotOnMove = (this.game.colorToMove == 1) ? 'b' : 'w';

                            if (pinColor != colorNotOnMove) {
                                return false;
                            }

                            // now check the delta with the pinPiece
                            if (absDelta == 15 || absDelta == 17) {
                                // bishop or queen
                                return pinPiece == 'q' || pinPiece == 'b';
                            } else {
                                // rook or queen
                                return pinPiece == 'r' || pinPiece == 'q';
                            }
                        }
                    }

                    ixSquare += delta;
                }
            }

            return false;
        },

        executeMove: function (move, direction, instant) {
            if (typeof (instant) === 'undefined') {
                instant = false;
            }

            if (direction > 0) {
                // if we don't have transitions for this move, calculate them based on the position
                if (move.transitions == null || move.transitions.length == 0) {
                    var transitions = this.generateTransitions(move);
                    this.game.moves[move.moveID].transitions = transitions;
                    move.transitions = transitions;
                }

                this.game.enPassant = '';

                // make the transitions
                for (var i = 0; i < move.transitions.length; i++) {
                    var transition = move.transitions[i];
                    var pieces = transition.split(':');

                    switch (pieces[0]) {
                        case 'm':
                            this.movePiece(pieces[1], pieces[2], instant);
                            break;

                        case 'a':
                            this.addPiece(pieces[1], pieces[2]);
                            break;

                        case 'r':
                            this.removePiece(pieces[1]);
                            break;

                        case 'e':
                            // update en passant
                            this.game.enPassant = pieces[1];
                            break;

                        case 'p':
                            // pawn promotion
                            // two parts: 1) remove pawn, 2) add promo piece
                            // pieces (1) toSquare (2) startSquare (3) color (4) promoPiece
                            this.removePiece(pieces[2]);
                            this.addPiece(pieces[1], pieces[3] + pieces[4]);
                            break;

                    }
                }

            } else if (direction < 0) {
                // moving backward
                if (move.transitions == null) {
                    // the backward transitions are the inverse of the forward ones
                    // and we can't get to a certain position without creating the transitions

                    console_log('[Replayer][Error] transitions have not been defined and we are trying to move backward');
                    return false;
                }

                // check to see if we have an en passant square
                var parentMove = this.game.moves[move.parentMoveID];
                if (parentMove != null && parentMove.transitions != null) {
                    var found = false;
                    for (var i = 0; i < parentMove.transitions.length; i++) {
                        if (parentMove.transitions[i].charAt(0) == 'e') {
                            found = true;
                            this.game.enPassant = parseInt(parentMove.transitions[i].charAt(2), 8);
                        }
                    }
                    if (!found) {
                        this.game.enPassant = '';
                    }
                }

                // make the transitions in reverse order
                for (var i = move.transitions.length - 1; i >= 0; i--) {
                    var transition = move.transitions[i];
                    var pieces = transition.split(':');
                    switch (pieces[0]) {
                        case 'm':
                            // move in the reverse direction
                            this.movePiece(pieces[2], pieces[1], instant);
                            break;

                        case 'a':
                            // remove the piece
                            this.removePiece(pieces[1]);
                            break;

                        case 'r':
                            this.addPiece(pieces[1], pieces[2]);
                            break;

                        case 'e':
                            // do nothing in the reverse direction, en passant is set from the parent move
                            break;

                        case 'p':
                            // undo a promotion
                            // two parts: 1) remove piece, 2) add back the pawn
                            // pieces (1) toSquare (2) startSquare (3) color (4) promoPiece
                            // remove the piece
                            this.removePiece(pieces[1]);
                            this.addPiece(pieces[2], pieces[3] + 'p');
                            break;

                    }

                }

            } else {
                //error
                console_log('unknown direction for animations');
            }
        },

        addPiece: function (square, piece) {
            var divID = this.elem.id + square;
            this.boardElement().append("<div id='" + divID + "' class='" + piece + "-" + this.settings["size"] + " chess-piece'></div>");

            var pieceSize = this.squareSizePixels();

            var row = Math.floor(square / 16);
            var col = square % 16;

            var calcRow;
            var calcCol;

            if (this.board.direction == -1) {
                // normal
                calcRow = (7 - row);
                calcCol = col;

            } else {
                // flipped
                calcRow = row;
                calcCol = (7 - col);
            }

            var posTop = pieceSize * calcRow + this.getShiftTop();
            var posLeft = pieceSize * calcCol + this.getShiftLeft();

            $('#' + divID).css({ position: 'absolute', top: posTop, left: posLeft, height: pieceSize + 'px', width: pieceSize + 'px' });

            // and finally update the board
            this.game.position[square] = piece;
        },

        removePiece: function (square) {
            var divID = this.elem.id + square;
            $('#' + divID).remove();

            // now update the board
            this.game.position[square] = null;
        },

        movePiece: function (from, to, instant) {
            // move the DOM element
            var oldDivId = this.elem.id + from;
            var newDivId = this.elem.id + to;
            var size = this.squareSizePixels();

            var top = (Math.floor(to / 16) - Math.floor(from / 16)) * size * this.board.direction;
            var left = ((from % 16) - (to % 16)) * size * this.board.direction;
            if (instant) {
                $('#' + oldDivId).css({
                    'top': '+=' + top + 'px',
                    'left': '+=' + left + 'px'
                });
            } else {
                $('#' + oldDivId).animate({
                    'top': '+=' + top + 'px',
                    'left': '+=' + left + 'px'
                }, 'fast');
            }

            // update the piece's ID
            $('#' + oldDivId).attr('id', newDivId);

            // update the internal state
            var piece = this.game.position[from];
            this.game.position[to] = piece;
            this.game.position[from] = null;

            // check to see if we should update king positions
            if (piece === 'wk') {
                this.game.whiteKingPosition = to;
            }

            if (piece === 'bk') {
                this.game.blackKingPosition = to;
            }
        }
    };

    Replayer.defaults = Replayer.prototype.defaults;

    // register replayer
    $.fn.replayer = function (options) {
        return this.each(function () {
            new Replayer(this, options).init();
        });
    };

    // closure compiler exports
    jQuery.prototype['replayer'] = $.fn.replayer;
    $.fn.replayer['defaults'] = Replayer.defaults;

})(jQuery, window, document);