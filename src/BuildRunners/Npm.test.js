/* eslint-env jest */

import { Npm } from "./Npm";
import tmp from "tmp";
import fs from "fs";
import path from "path";
import { expect } from "chai";

describe("createCredentials", () => {
  var tempDir = tmp.dirSync({ unsafeCleanup: true });
  var npmHandler;
  const authToken = "authToken";
  beforeAll(() => {
    process.env.NPM_AUTH_TOKEN = authToken;
    jest.setTimeout(20000);
  });

  afterAll(() => {
    tempDir.removeCallback();
  });

  it("it uses values from the environment", async () => {
    npmHandler = await Npm({ userFolder: tempDir.name });
    npmHandler.createCredentials();
    var configData = fs.readFileSync(path.join(tempDir.name, ".npmrc"), "utf8");
    expect(configData).contain(
      `//registry.npmjs.org/:_authToken=${authToken}\n`
    );
  });

  it("creates npm user folder if does not exists", async () => {
    const innerPath = path.join(tempDir.name, "inner");
    npmHandler = await Npm({ userFolder: innerPath });
    npmHandler.createCredentials();

    var configData = fs.readFileSync(path.join(innerPath, ".npmrc"), "utf8");
    expect(configData).not.to.equal(null);
  });

  it("uses provided values over the environment values", async () => {
    npmHandler = await Npm({
      registryUrl: "validRegistryURl",
      authToken: "validAuthToken",
      userFolder: tempDir.name
    });
    npmHandler.createCredentials();
    var configData = fs.readFileSync(path.join(tempDir.name, ".npmrc"), "utf8");
    expect(configData).contain(
      "//validRegistryURl:_authToken=validAuthToken\n"
    );
  });
});
