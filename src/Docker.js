import {
  Logger,
  ParameterProvider,
  ProcessUtils,
  StringUtils
} from "@cantrips/core"

class Docker {
  constructor(location, commandRunner) {
    this.location = location
    this.runCommand = commandRunner || ProcessUtils.runCommand
    this.parameterProvider = new ParameterProvider()
  }

  getFirstMatchOrDefault(text, regex) {
    const result = text.match(regex)
    return result ? result[1] : null
  }

  computeTagsByDockerFiles(parsedImageDescriptors) {
    const resultHash = {}
    parsedImageDescriptors.forEach(imageDescriptor => {
      const dockerFile = this.getFirstMatchOrDefault(imageDescriptor, /.*\[(.*)\]/)  || "Dockerfile"
      const tag = this.getFirstMatchOrDefault(imageDescriptor, /:([^[\s]*)/) || "latest"
      const imageName = this.getFirstMatchOrDefault(imageDescriptor, /^([^:^[.]+)/) || ""

      if (!resultHash[dockerFile]) {
        resultHash[dockerFile] = []
      }
      resultHash[dockerFile].push(`${imageName}:${tag}`)
    })
    return resultHash
  }

  async build({ images, noCache = false } = {}) {
    images = images || (await this.computeDefaultImageName())
    const parsedImageDescriptors = images.split(",")
    const imageTagsByDockerFiles = this.computeTagsByDockerFiles(
      parsedImageDescriptors
    )
    await Promise.all(Object.keys(imageTagsByDockerFiles).map(async dockerFile => {
      const tagCommandString = imageTagsByDockerFiles[dockerFile].join(" -t ")
      return this.runCommand(
        `docker build -f ${dockerFile} ${
          noCache ? " --no-cache" : ""
        } -t ${tagCommandString} .`,
        `Building docker image ${images}`
      )
    }))
  }

  async push({ imageName, registryUrl, tags, latest = false } = {}) {
    imageName =
      imageName ||
      (await StringUtils.normalizeString(await this.computeDefaultImageName()))
    registryUrl =
      registryUrl ||
      (await this.parameterProvider.getParameter("DockerRegistry"))
    tags = (tags && tags.split(",")) || (await this.computeDefaultTags())
    latest = latest === true

    if (!StringUtils.isNormalizedString(imageName)) {
      Logger.error(`Image name ${imageName} is not a valid docker image name.`)
    }

    var fullPushTargetPath = registryUrl
      ? `${registryUrl}/${imageName}`
      : imageName

    await this.tag(imageName, "latest", "latest", fullPushTargetPath)

    if (latest) {
      Logger.debug("Pushing latest image")

      await this.runCommand(
        `docker push ${fullPushTargetPath}:latest`,
        `Pushing docker image ${fullPushTargetPath}:latest`
      )
    }
    for (const tag of tags) {
      if (!StringUtils.isNormalizedString(tag)) {
        Logger.error(`Tag ${tag} is not a valid docker image name.`)
      }
      await this.tag(fullPushTargetPath, "latest", tag)
      await this.runCommand(
        `docker push ${fullPushTargetPath}:${tag}`,
        `Pushing image ${fullPushTargetPath}:${tag}`
      )
    }
  }

  async tag(imageToTag, oldTag, newTag, newImageName) {
    newImageName = newImageName || imageToTag
    return this.runCommand(
      `docker tag ${imageToTag}:${oldTag} ${newImageName}:${newTag}`,
      `Tagging image ${imageToTag}:${oldTag} as ${newImageName}:${newTag}`
    )
  }

  async login({ username, password, registryUrl } = {}) {
    username = username || process.env.DOCKER_USERNAME
    password = password || process.env.DOCKER_PASSWORD
    registryUrl = registryUrl || process.env.DOCKER_REGISTRY
    return this.runCommand(
      `docker login -u ${username} -p ${password} ${registryUrl}`,
      `Logging into ${registryUrl}`
    )
  }

  async computeDefaultTags() {
    return (await this.parameterProvider.getParameter("IsRelease"))
      ? [this.parameterProvider.getParameter("ReleaseVersion")]
      : [
          StringUtils.normalizeString(
            await this.parameterProvider.getParameter("ShortHash")
          )
        ]
  }

  async computeDefaultImageName() {
    return StringUtils.normalizeString(
      await this.parameterProvider.getParameter("ProjectName")
    )
  }
}

module.exports = {
  exposed: {
    build: {
      parameters: [
        {
          name: "images",
          help:
            "Descriptor of the result images. Ex:\
            my-image => Building my-image:latest from Dockerfile\
            my-image:customTag => Building my-image:customTag from Dockerfile\
            my-image:someTag[Dockerfile.web] => Building my-image:someTag from Dockerfile.web\
            my-image[Dockerfile.web],my-image:someTag => Building my-image from Dockerfile.web\
                                                         and building my-image:someTag from Dockerfile"
        },
        {
          name: "noCache",
          help: "Using noCache option",
          flag: true
        }
      ]
    },
    login: {
      name: "login",
      parameters: [
        {
          name: "username",
          help: "Docker registry user name"
        },
        {
          name: "password",
          help: "Docker registry user password"
        }
      ]
    },
    push: {
      parameters: [
        {
          name: "imageName",
          help: "If active, do not push the image to remote"
        },
        {
          name: "registryUrl",
          help: "The target Docker Registry url"
        },
        {
          name: "tags",
          help: "Coma separated list of tags to push to"
        },
        {
          name: "latest",
          help: "Should a latest tag be pushed",
          flag: true
        }
      ]
    }
  },
  meta: {
    name: "docker",
    parameters: [
      {
        name: "skipPush",
        help: "If active, do not push the image to remote"
      }
    ],
    type: Docker
  },
  Docker
}
