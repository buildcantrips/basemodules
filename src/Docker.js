import {
  Logger,
  ParameterProvider,
  ProcessUtils,
  StringUtils
} from "@cantrips/core"

class Docker {
  constructor(location, commandRunner) {
    this.location = location
    this.runCommand = commandRunner || ProcessUtils.runCommandSync
    this.parameterProvider = new ParameterProvider()
  }

  getFirstMatchOrDefault(text, regex) {
    const result = text.match(regex)
    return result ? result[1] : null
  }

  computeTagsByDockerFilesFromString(parsedImageDescriptors) {
    const resultHash = {}
    parsedImageDescriptors.forEach(imageDescriptor => {
      const dockerFile =
        this.getFirstMatchOrDefault(imageDescriptor, /.*\[(.*)\]/) ||
        "Dockerfile"
      const tag =
        this.getFirstMatchOrDefault(imageDescriptor, /:([^[\s]*)/) || "latest"
      const imageName =
        this.getFirstMatchOrDefault(imageDescriptor, /^([^:^[.]+)/) || ""

      if (!StringUtils.isNormalizedString(imageName)) {
        throw `Image name ${imageName} is not a valid docker image name.`
      }

      if (!resultHash[dockerFile]) {
        resultHash[dockerFile] = []
      }
      resultHash[dockerFile].push(`${imageName}:${tag}`)
    })
    return resultHash
  }
  async computeTagsByDockerFilesFromJson(parsedImageDescriptorJson) {
    const resultHash = {}
    Object.keys(parsedImageDescriptorJson).forEach(async imageName => {
      if (!StringUtils.isNormalizedString(imageName)) {
        throw `Image name ${imageName} is not a valid docker image name.`
      }

      const dockerFile =
        parsedImageDescriptorJson[imageName]["dockerFile"] || "Dockerfile"

      const tags = parsedImageDescriptorJson[imageName]["tags"] || ["latest"]

      if (!resultHash[dockerFile]) {
        resultHash[dockerFile] = []
      }
      tags.forEach(tag => {
        resultHash[dockerFile].push(`${imageName}:${tag}`)
      })
    })
    return resultHash
  }

  async computeImagesByDockerFiles(images) {
    let imagesByDockerFiles
    images = images || (await this.computeDefaultImageName())
    try {
      const parsedImageDescriptors = JSON.parse(images)
      imagesByDockerFiles = await this.computeTagsByDockerFilesFromJson(
        parsedImageDescriptors["docker"]
      )
      Logger.debug("Docker - Json input format detected")
    } catch (e) {
      const parsedImageDescriptors = images.split(",")
      imagesByDockerFiles = await this.computeTagsByDockerFilesFromString(
        parsedImageDescriptors
      )
      Logger.debug("Docker - String input format detected")
    }
    Logger.debug(`Detected: ${JSON.stringify(imagesByDockerFiles, null, 2)}`)
    return imagesByDockerFiles
  }

  async build({ images, noCache = false } = {}) {
    let imagesByDockerFiles = await this.computeImagesByDockerFiles(images)
    for (let dockerFile of Object.keys(imagesByDockerFiles)) {
      const tagCommandString = imagesByDockerFiles[dockerFile].join(" -t ")

      this.runCommand(
        `docker build -f ${dockerFile} ${
          noCache ? " --no-cache" : ""
        } -t ${tagCommandString} .`,
        `Building docker image from dockerfile ${dockerFile} with tags ${imagesByDockerFiles[
          dockerFile
        ].join(" ")}`
      )
    }
  }

  async push(options = {}) {
    let {
      images,
      registryUrl = await this.parameterProvider.getParameter("DockerRegistry")
    } = options

    const imagesByDockerFiles = await this.computeImagesByDockerFiles(images)

    for (let dockerFile of Object.keys(imagesByDockerFiles)) {
      for (let image of imagesByDockerFiles[dockerFile]) {
        this.runCommand(
          `docker push ${registryUrl}/${image}`,
          `Pushing image ${registryUrl}/${image}`
        )
      }
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
