import { Logger, ParameterProvider, Utils } from "@cantrips/core";

class Docker {
  constructor(location, commandRunner = undefined) {
    this.location = location;
    this.runCommand = commandRunner || Utils.runCommand;
    this.parameterProvider = new ParameterProvider();
  }

  async build(imageName = undefined, noCache = true) {
    imageName = imageName || (await this.computeDefaultImageName());
    return this.runCommand(
      `docker build ${noCache ? " --no-cache" : ""} -t ${imageName} .`,
      `Building docker image ${imageName}`
    );
  }

  async push(
    imageName = undefined,
    target = undefined,
    tags = undefined,
    latest = false
  ) {
    imageName =
      imageName ||
      (await Utils.normalizeString(await this.computeDefaultImageName()));
    target =
      target || (await this.parameterProvider.getParameter("DockerTarget"));
    tags = tags || (await this.computeDefaultTags());

    if (!Utils.isNormalizedString(imageName)) {
      Logger.error(`Image name ${imageName} is not a valid docker image name.`);
    }

    var fullPushTargetPath = target ? `${target}/${imageName}` : imageName;

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

  async login(username = undefined, password = undefined) {
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
  exposed: ["login", "build", "push"],
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
