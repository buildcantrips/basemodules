/* eslint-env mocha */

import { Npm } from "./Npm"
import tmp from "tmp"
import fs from "fs"
import path from "path"
import { expect } from "chai"

describe("createCredentials", () => {
  var tempDir
  var npmHandler
  const authToken = "authToken"

  before(async ()=> {
    process.env.NPM_AUTH_TOKEN = authToken
    tempDir = tmp.dirSync({ unsafeCleanup: true })
    await Npm({ userFolder: tempDir })
  })
  beforeEach(() => {
    tempDir = tmp.dirSync({ unsafeCleanup: true })
  })

  afterEach(() => {
    tempDir.removeCallback()
  })

  it("creates npm user folder if does not exists", async () => {
    const innerPath = path.join(tempDir.name, "inner")
    npmHandler = await Npm({ userFolder: innerPath })
    npmHandler.createCredentials()

    var configData = fs.readFileSync(path.join(innerPath, ".npmrc"), "utf8")
    expect(configData).not.to.equal(null)
  })

  it("uses provided values over the environment values", async () => {
    npmHandler = await Npm({
      registryUrl: "validRegistryURl",
      authToken: "validAuthToken",
      userFolder: tempDir.name
    })
    npmHandler.createCredentials()
    var configData = fs.readFileSync(path.join(tempDir.name, ".npmrc"), "utf8")
    expect(configData).contain(
      "//validRegistryURl:_authToken=validAuthToken\n"
    )
  })

  it("it uses values from the environment", async () => {
    npmHandler = await Npm({ userFolder: tempDir.name })
    npmHandler.createCredentials()
    var configData = fs.readFileSync(path.join(tempDir.name, ".npmrc"), "utf8")
    expect(configData).contain(
      `//registry.npmjs.org/:_authToken=${authToken}\n`
    )
  })
})
