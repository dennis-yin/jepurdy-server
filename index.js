const app = require("express")();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const cors = require("cors");
const router = require("./router");

const {
  addPlayer,
  getPlayer,
  getPlayersInLobby,
  updatePlayerScore,
} = require("./players");
const { getAllTiles } = require("./tiles");
const { setTileToViewed } = require("./helpers");
const {
  ROUND_ONE,
  ROUND_TWO,
  ROUND_THREE,
  TILES_PER_ROUND,
} = require("./constants");

app.use(cors());
app.use(router);

const gameServer = () => {
  const lobbies = {};
  const players = [];

  io.on("connection", (socket) => {
    let gameState;

    socket.on("join", async ({ username, lobby }, callback) => {
      const { error, player } = addPlayer({
        players,
        id: socket.id,
        username,
        lobby,
      });

      if (error) return callback(error);

      if (lobbies[lobby]) {
        lobbies[lobby].numPlayersInLobby++;
      } else {
        try {
          const tiles = await getAllTiles();

          lobbies[lobby] = {
            tiles: tiles,
            numPlayersInLobby: 1,
            round: ROUND_ONE,
            playerToPick: player.id,
            buzzes: { current: "", history: [] },
            tilesLeftInRound: TILES_PER_ROUND,
            wagers: [],
            answeredRoundThree: [],
          };
        } catch (err) {
          throw new Error(err);
        }
      }

      socket.join(lobby);

      gameState = lobbies[lobby];

      const playersInLobby = getPlayersInLobby(players, lobby);
      io.in(player.lobby).emit("playerData", playersInLobby);

      socket.emit("tileData", gameState.tiles.roundOne);
      socket.emit("toggleLoading");

      callback();
    });

    socket.on("tileSelection", ({ tile, playerID }) => {
      if (playerID === gameState.playerToPick && !tile.viewed) {
        const player = getPlayer(players, socket.id);
        io.in(player.lobby).emit("tileSelection", tile);

        gameState.selectedTile = tile;
        gameState.tilesLeftInRound--;

        const currRound =
          gameState.round === ROUND_ONE ? "roundOne" : "roundTwo";
        setTileToViewed(gameState.tiles[currRound], tile);
        io.in(player.lobby).emit("tileData", gameState.tiles[currRound]);
      }
    });

    socket.on("buzzIn", (playerID) => {
      if (
        !gameState.buzzes.current &&
        !gameState.buzzes.history.includes(playerID)
      ) {
        gameState.buzzes.current = playerID;
        const player = getPlayer(players, playerID);

        io.in(player.lobby).emit("playerToAnswer", {
          playerID: gameState.buzzes.current,
          username: player.username,
        });
      }
    });

    socket.on("playerAnswer", ({ playerID, playerAnswer }) => {
      if (gameState.selectedTile) {
        const correct = playerAnswer === gameState.selectedTile.answer;

        if (
          gameState.round === ROUND_THREE &&
          !gameState.answeredRoundThree.includes(playerID)
        ) {
          const playerWager = gameState.wagers.find(
            (entry) => entry.playerID === playerID
          ).wager;
          updatePlayerScore(players, playerID, correct, playerWager);

          gameState.answeredRoundThree.push(playerID);
          if (
            gameState.answeredRoundThree.length === gameState.numPlayersInLobby
          ) {
            const player = getPlayer(players, socket.id);
            const playersInLobby = getPlayersInLobby(players, player.lobby);
            io.in(player.lobby).emit("playerData", playersInLobby);
            io.in(player.lobby).emit("showResults");
          }
        }

        if (playerID === gameState.buzzes.current) {
          gameState.buzzes.current = "";
          gameState.buzzes.history.push(playerID);
          const player = getPlayer(players, playerID);

          // Update the scores and send them to everyone
          updatePlayerScore(
            players,
            playerID,
            correct,
            gameState.selectedTile.value
          );
          const playersInLobby = getPlayersInLobby(players, player.lobby);
          io.in(player.lobby).emit("playerData", playersInLobby);

          // Inform everyone of the player's answer and whether or not it was correct
          io.in(player.lobby).emit("playerAnswer", {
            playerName: player.username,
            playerAnswer,
            correct,
          });

          if (
            correct ||
            gameState.buzzes.history.length === gameState.numPlayersInLobby
          ) {
            gameState.buzzes = { current: "", history: [] }; // Reset the buzzes
            gameState.selectedTile = null;

            if (correct) {
              gameState.playerToPick = playerID;
            }

            if (gameState.tilesLeftInRound === 0) {
              if (gameState.round === ROUND_ONE) {
                io.in(player.lobby).emit("tileData", gameState.tiles.roundTwo);
                gameState.round = ROUND_TWO;
                gameState.tilesLeftInRound = TILES_PER_ROUND;
              } else if (gameState.round === ROUND_TWO) {
                gameState.round = ROUND_THREE;
                gameState.tilesLeftInRound = 1;
                gameState.selectedTile = gameState.tiles.roundThree[0];
              }
            }

            io.in(player.lobby).emit("tileSelection", gameState.selectedTile);
          }
        }
      }
    });

    socket.on("playerWager", ({ playerID, wager }) => {
      const player = getPlayer(players, playerID);

      if (wager > player.score || wager < 0) {
        socket.emit("invalidWager");
      } else {
        gameState.wagers.push({ playerID, wager: wager.toString() });
        socket.emit("validWager");

        if (gameState.wagers.length === gameState.numPlayersInLobby) {
          io.in(player.lobby).emit("allWagersPlaced", gameState.wagers);
        }
      }
    });

    socket.on("error", (error) => {
      console.log(error);
    });

    socket.on("disconnect", () => {
      socket.removeAllListeners();
    });
  });
};

gameServer();

server.listen(process.env.PORT || 8080, () => {
  console.log("Server listening");
});
