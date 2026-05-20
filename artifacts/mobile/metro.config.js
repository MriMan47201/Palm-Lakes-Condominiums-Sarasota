const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
  /node_modules\/.*\/vite_tmp_.*/,
];

module.exports = config;
