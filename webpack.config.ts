import path from "path";
import HtmlWebpackPlugin from "html-webpack-plugin";
import { Configuration } from "webpack";
import "webpack-dev-server";

const config: Configuration = {
  mode: "development",
  entry: "./src/index.ts",

  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "dist"),
    publicPath: "/",
  },

  devServer: {
    static: {
      directory: path.join(__dirname, "dist"),
      serveIndex: true,
    },
    port: 9000,
    compress: true,
    hot: true,
    open: false,
    historyApiFallback: true,
  },

  resolve: {
    extensions: [".ts", ".js"],
  },

  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env", "@babel/preset-typescript"],
          },
        },
      },
    ],
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: "./src/index.html",
      scriptLoading: "blocking",
    }),
  ],

  devtool: "source-map",
};

export default config;
