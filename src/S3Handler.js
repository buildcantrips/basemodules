"use strict";

import { ContainerProvider, Logger } from "@cantrips/core";

class S3Handler {
  constructor({ accessKeyId, secretAccessKey }) {
    this.imageUrl = "garland/aws-cli-docker";
    this.container = undefined;
    this.accessKeyId = accessKeyId || process.env.AWS_ACCESS_KEY_ID;
    this.secretAccessKey = secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY;
    if (!this.accessKeyId || !this.secretAccessKey) {
      throw Error(
        "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment parameters are mandatory"
      );
    }
  }

  async init() {
    this.container = await ContainerProvider(this.imageUrl);
    this.container.addEnvironmentVariable(
      "AWS_ACCESS_KEY_ID",
      this.accessKeyId
    );
    this.container.addEnvironmentVariable(
      "AWS_SECRET_ACCESS_KEY",
      this.secretAccessKey
    );
  }

  async list(bucketName) {
    await this.container.run(
      `aws s3 ls ${bucketName}`,
      `Listing bucket ${bucketName}`
    );
  }

  async get(fileUri, targetPath) {
    if (!fileUri.startsWith("s3://")) {
      throw Error('First parameter must start with "s3://"');
    }
    if (!targetPath) {
      targetPath = `./${fileUri
        .split("/")
        .slice(-1)
        .pop()}`;
    }
    Logger.info(`Downloading file from ${fileUri} to ${targetPath}`);
    await this.container.run(`aws s3 cp ${fileUri} ${targetPath}`, "");
  }
}

const wrapper = async (...args) => {
  const handler = new S3Handler(args);
  await handler.init();
  return handler;
};

module.exports = {
  exposed: ["list", "get"],
  meta: {
    name: "s3",
    parameters: [],
    type: wrapper
  },
  S3Handler: wrapper
};
