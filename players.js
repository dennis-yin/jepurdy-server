const addPlayer = ({ players, id, username, lobby }) => {
  username = username.trim();
  lobby = lobby.trim().toLowerCase();

  const existingPlayer = players.find(
    (player) => player.lobby === lobby && player.username === username
  );

  if (!username || !lobby) return { error: "Username and lobby are required." };
  if (existingPlayer) return { error: "Username is taken." };

  const player = { id, username, lobby, score: 0 };

  players.push(player);

  return { player };
};

const removePlayer = (players, id) => {
  const index = players.findIndex((player) => player.id === id);

  if (index !== -1) return players.splice(index, 1)[0];
};

const getPlayer = (players, id) => players.find((player) => player.id === id);

const getPlayersInLobby = (players, lobby) => {
  return players.filter((player) => player.lobby === lobby);
};

const updatePlayerScore = (players, playerID, correct, value) => {
  const trimmedValue = Number(value.replace("$", ""));

  players.map((player) => {
    if (player.id === playerID) {
      player.score = correct
        ? player.score + trimmedValue
        : player.score - trimmedValue;
    }
  });
};

module.exports = {
  addPlayer,
  removePlayer,
  getPlayer,
  getPlayersInLobby,
  updatePlayerScore,
};
