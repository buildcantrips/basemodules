import fs from "fs"
import path from "path"
import { Logger, ContainerProvider } from "@cantrips/core"

class Npm {
  constructor({ registryUrl, authToken, userFolder }) {
    Logger.info(authToken)
    this.authToken = authToken || process.env.NPM_AUTH_TOKEN
    if (!this.authToken) {
      throw new Error("NPM_AUTH_TOKEN is mandatory!")
    }
    this.registryUrl =
      registryUrl || process.env.NPM_REGISTRY_URL || "registry.npmjs.org/"
    this.userFolder = userFolder || process.env.HOME
    this.imageUrl = "node"
    this.container = undefined
  }

  async init() {
    this.container = await ContainerProvider(this.imageUrl)
  }

  createCredentials() {
    Logger.info(`Creating Npm credential file...`)
    if (!fs.existsSync(this.userFolder)) {
      fs.mkdirSync(this.userFolder)
    }

    const config = `//${this.registryUrl}:_authToken=${this.authToken}\n`
    const configFilePath = path.join(this.userFolder, ".npmrc")
    if (fs.existsSync(configFilePath)) {
      Logger.warn(
        `Backing up existing npmrc ${configFilePath} as ${configFilePath}_old`
      )
      fs.renameSync(configFilePath, `${configFilePath}_old`)
    }

    fs.writeFileSync(configFilePath, config, { mode: "600" })
    Logger.info(`Npm credential file created: ${configFilePath}`)
  }
}

async function wrapper(args) {
  const handler = new Npm(args)
  await handler.init()
  return handler
}

module.exports = {
  exposed: {
    createCredentials: {
      description: "Injecting NPM credential information to the environment"
    }
  },
  meta: {
    name: "npm",
    description: "Solves various NPM related tasks",
    parameters: [
      {
        name: "registryUrl",
        description:
          "The url of the target registry. Environment: NPM_REGISTRY_URL. Defaults to registry.npmjs.org/"
      },
      {
        name: "authToken",
        description:
          "Token to authenticate to the target registry. Environment: NPM_AUTH_TOKEN. (Mandatory)"
      },
      {
        name: "userFolder",
        description:
          "The current user's home directory. Defaults to the default HOME directory"
      }
    ],
    type: wrapper
  },
  Npm: wrapper
}
