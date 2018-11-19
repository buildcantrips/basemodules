import { ParameterProvider, Logger, ContainerProvider } from "@cantrips/core"

class ElasticBeanstalk {
  constructor() {
    this.imageUrl = "mini/eb-cli"
    this.container = undefined
    this.parameterProvider = new ParameterProvider()
  }

  async init() {
    this.container = await ContainerProvider(this.imageUrl, {
      volumes: ["$HOME/.aws:/home/aws/.aws"]
    })
  }

  // branchName:environmentName|branchName:environmentName
  async resolvePatternString(patternString) {
    return patternString.split("|").reduce((aggregated, pattern) => {
      const tokens = pattern.split(":")
      if (tokens.length === 2) {
        aggregated[tokens[0]] = tokens[1]
      } else {
        Logger.warn(`Invalid pattern string fragment: '${pattern}'`)
      }
      return aggregated
    }, {})
  }

  async deploy(patternString = undefined, timeout = 60) {
    Logger.info("Starting Elastic Beanstalk deployment")
    patternString = patternString || process.env.EB_DEPLOYMENT_PATTERN_STRING
    if (!patternString) {
      throw Error("EB_DEPLOYMENT_PATTERN_STRING variable is mandatory.")
    }
    const deploymentRules = await this.resolvePatternString(patternString)
    Logger.debug(`Using rules:\n${JSON.stringify(deploymentRules, null, 2)}`)
    const branchName = await this.parameterProvider.getParameter("BranchName")
    if (!branchName) {
      throw Error("Cannot determine branch name!")
    }
    Logger.debug(`Current branch name: ${branchName}`)
    const targetEnvironment = deploymentRules[branchName] || undefined
    if (!targetEnvironment) {
      throw Error(`No matching environment for branch ${branchName}`)
    }
    Logger.debug(`Matching environment name: ${targetEnvironment}`)
    return this.container.run(
      `init && eb deploy ${targetEnvironment} --timeout ${timeout}`
    )
  }
}

async function wrapper(args) {
  const handler = new ElasticBeanstalk(args)
  await handler.init()
  return handler
}

module.exports = {
  exposed: ["deploy"],
  meta: {
    name: "elb",
    parameters: [],
    type: wrapper
  },
  ElasticBeanstalk: wrapper
}
