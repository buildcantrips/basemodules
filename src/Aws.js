import fs from "fs"
import path from "path"
import { Logger } from "@cantrips/core"

class Aws {
  constructor({ accessKeyId, secretAccessKey, userFolder }) {
    Logger.info(`Creating AWS credential file...`)
    this.accessKeyId = accessKeyId || process.env.AWS_ACCESS_KEY_ID
    this.secretAccessKey = secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY
    this.userFolder = userFolder || path.join(process.env.HOME, ".aws")

    if (!this.accessKeyId || !this.secretAccessKey) {
      throw Error(
        "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment parameters are mandatory"
      )
    }
  }

  createCredentials() {
    if (!fs.existsSync(this.userFolder)) {
      fs.mkdirSync(this.userFolder)
    }

    const config = `[profile eb-cli]\naws_access_key_id=${
      this.accessKeyId
    }\naws_secret_access_key=${this.secretAccessKey}\n`
    const configFilePath = path.join(this.userFolder, "config")
    if (fs.existsSync(configFilePath)) {
      Logger.warn(
        `Backing up existing npmrc ${configFilePath} as ${configFilePath}_old`
      )
      fs.renameSync(configFilePath, `${configFilePath}_old`)
    }

    fs.writeFileSync(configFilePath, config, { mode: "600" })

    Logger.info(`AWS credential file created: ${this.userFolder}/config`)
  }
}

module.exports = {
  exposed: ["createCredentials"],
  meta: {
    name: "aws",
    parameters: [
      {
        name: "accessKeyId",
        help: "Which accessKeyId to use"
      },
      { name: "secretAccessKey", help: "Which secretKeyId to use" },
      { name: "userFolder", help: "Which userFolder to use" }
    ],
    type: Aws
  },
  Aws
}
