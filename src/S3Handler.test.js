/* eslint-env jest */

import { S3Handler } from "./S3Handler"
import chai, { expect } from "chai"
import chaiAsPromised from "chai-as-promised"

chai.use(chaiAsPromised)

describe("S3Handler", () => {
  var s3Handler
  var messages = []
  const validBucketName = "validBucketName"
  const validFileName = "validFileName"
  const validFolderName = "validFolderName"
  const validAccessKeyId = "validAccessKeyId"
  const validSecretAccessKey = "validSecretAccessKey"
  beforeAll(async () => {
    jest.setTimeout(20000)
    process.env.AWS_ACCESS_KEY_ID = validAccessKeyId
    process.env.AWS_SECRET_ACCESS_KEY = validSecretAccessKey
    s3Handler = await S3Handler({
      s3Uri: "uri"
    })
  })
  beforeEach(() => {
    messages = []
  })
  describe("S3Handler", () => {
    it("passes keys to the container", async () => {
      expect(Object.keys(s3Handler.container.environment))
        .to.include("AWS_ACCESS_KEY_ID")
        .and.to.includes("AWS_SECRET_ACCESS_KEY")
    })
    it("fails if no mandatory parameters are given", async () => {
      expect(S3Handler({ s3Uri: "uri" })).to.be.rejectedWith(
        Error,
        /parameters are mandatory/
      )
    })

    describe("list", async () => {
      beforeAll(async () => {
        s3Handler = await S3Handler({
          accessKeyId: "keyId",
          secretAccessKey: "accessKey",
          s3Uri: "uri"
        })
        s3Handler.container = {
          run(command) {
            messages.push(command)
          }
        }
      })
      it("lists given bucket", () => {
        s3Handler.list(validBucketName)
        expect(messages[0]).to.contain(`aws s3 ls ${validBucketName}`)
      })
    })
    describe("get", async () => {
      beforeAll(async () => {
        s3Handler = await S3Handler({
          s3Uri: "uri"
        })
        s3Handler.container = {
          run(command) {
            messages.push(command)
          }
        }
      })
      it("downloads file from s3 to local", () => {
        s3Handler.get(
          `s3://${validBucketName}/${validFileName}`,
          `${validFolderName}/${validFileName}`
        )
        expect(messages[0]).to.contain(
          `aws s3 cp s3://${validBucketName}/${validFileName} ${validFolderName}/${validFileName}`
        )
      })

      it("download files to workdir", () => {
        s3Handler.get(`s3://${validBucketName}/${validFileName}`)
        expect(messages[0]).to.contain(
          `aws s3 cp s3://${validBucketName}/${validFileName} ./${validFileName}`
        )
      })

      it("throws error if first parameter is not an s3 uri", () => {
        expect(
          s3Handler.get(`${validBucketName}/${validFileName}`)
        ).to.be.rejectedWith(Error, /must start with "s3/)
      })
    })
  })
})
