/* eslint-env jest */

import { Aws } from "./aws";
import tmp from "tmp";
import fs from "fs";
import path from "path";

import { expect } from "chai";

describe("createCredentials", () => {
  var aws;
  var tempDir = tmp.dirSync({ unsafeCleanup: true });
  const validAccessKeyId = "validAccessKeyId";
  const validSecretAccessKey = "validSecretAccessKey";
  beforeAll(() => {
    process.env.AWS_ACCESS_KEY_ID = validAccessKeyId;
    process.env.AWS_SECRET_ACCESS_KEY = validSecretAccessKey;
    aws = new Aws({ userFolder: tempDir.name });
  });

  afterAll(() => {
    tempDir.removeCallback();
  });

  it("it uses values from the environment", async () => {
    await aws.createCredentials();
    var configData = fs.readFileSync(path.join(tempDir.name, "config"), "utf8");
    expect(configData).contain(`aws_access_key_id=${validAccessKeyId}`);
    expect(configData).contain(`aws_secret_access_key=${validSecretAccessKey}`);
  });

  it("creates aws user folder if does not exists", async () => {
    const innerPath = path.join(tempDir.name, "inner");
    aws = new Aws({ userFolder: innerPath });
    await aws.createCredentials();
    var configData = fs.readFileSync(path.join(innerPath, "config"), "utf8");
    expect(configData).not.to.equal(null);
  });

  it("writes the header", async () => {
    await aws.createCredentials({ userFolder: tempDir.name });
    var configData = fs.readFileSync(path.join(tempDir.name, "config"), "utf8");
    expect(configData).contain("[profile eb-cli]");
  });

  it("uses provided values over the environment values", async () => {
    aws = new Aws({
      accessKeyId: "validAccessParameter",
      secretAccessKey: "validSecretAccessParameter",
      userFolder: tempDir.name
    });
    aws.createCredentials();
    var configData = fs.readFileSync(path.join(tempDir.name, "config"), "utf8");
    expect(configData).contain("aws_access_key_id=validAccessParameter");
    expect(configData).contain(
      "aws_secret_access_key=validSecretAccessParameter"
    );
  });
});
