import { Logger, ParameterProvider, Utils } from "@cantrips/core";

class Docker {
  constructor(location, commandRunner = undefined) {
    this.location = location;
    this.runCommand = commandRunner || Utils.runCommand;
    this.parameterProvider = new ParameterProvider();
  }

  async build({imageName = undefined, noCache = false}) {
    imageName = imageName || (await this.computeDefaultImageName());
    return this.runCommand(
      `docker build ${noCache ? " --no-cache" : ""} -t ${imageName} .`,
      `Building docker image ${imageName}`
    );
  }

  async push({
    imageName = undefined,
    registryUrl = undefined,
    tags = undefined,
    latest = false
  }) {
    imageName =
      imageName ||
      (await Utils.normalizeString(await this.computeDefaultImageName()));
    registryUrl =
      registryUrl ||
      (await this.parameterProvider.getParameter("DockerRegistry"));
    tags = tags.split(",") || (await this.computeDefaultTags());
    latest = latest === "true";

    if (!Utils.isNormalizedString(imageName)) {
      Logger.error(`Image name ${imageName} is not a valid docker image name.`);
    }

    var fullPushTargetPath = registryUrl
      ? `${registryUrl}/${imageName}`
      : imageName;

    if (latest) {
      Logger.debug("Pushing latest image");
      await this.runCommand(
        `docker push ${fullPushTargetPath}:latest`,
        `Pushing docker image ${fullPushTargetPath}:latest`
      );
    }
    for (const tag of tags) {
      if (!Utils.isNormalizedString(tag)) {
        Logger.error(`Tag ${tag} is not a valid docker image name.`);
      }
      await this.tag(fullPushTargetPath, "latest", tag);
      await this.runCommand(
        `docker push ${fullPushTargetPath}:${tag}`,
        `Pushing docker image ${fullPushTargetPath}:${tag}`
      );
    }
  }

  async tag(imageToTag, oldTag, newTag) {
    Logger.info(`Tagging image ${imageToTag} with tag ${newTag}`);
    return this.runCommand(
      `docker tag ${imageToTag}:${oldTag} ${imageToTag}:${newTag}`,
      `Tagging image ${imageToTag}:${newTag}`
    );
  }

  async login({username = undefined, password = undefined}) {
    username = username || process.env.DOCKER_USERNAME;
    password = password || process.env.DOCKER_PASSWORD;
    return this.runCommand(
      `docker login -u ${username} -p ${password}`,
      `Logging into docker`
    );
  }

  async computeDefaultTags() {
    return (await this.parameterProvider.getParameter("IsRelease"))
      ? [this.parameterProvider.getParameter("ReleaseVersion")]
      : [
          Utils.normalizeString(
            await this.parameterProvider.getParameter("BranchName")
          )
        ];
  }

  async computeDefaultImageName() {
    return Utils.normalizeString(
      await this.parameterProvider.getParameter("ProjectName")
    );
  }
}

module.exports = {
  exposed: {
    build: {
      parameters: [
        {
          name: "imageName",
          help: "The name of the result image"
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
};
