/* eslint-env mocha */

import { Docker } from "./Docker"
import { FileSystemUtils } from "@cantrips/core"

import path from "path"
import { expect } from "chai"
import childProcess from "child_process"
import fs from "fs"
import osTmpdir from "os-tmpdir"

let tempDir = path.join(osTmpdir(), "cantrips_test_dir")

function recreateGitRepository() {
  if (fs.existsSync(tempDir)) {
    FileSystemUtils.deleteFolderRecursive(tempDir)
  }
  fs.mkdirSync(tempDir)
  childProcess.execSync(`cd ${tempDir} &&
    echo "from scratch \n COPY * /" >> Dockerfile`)
}

function getDockerImageList() {
  return childProcess
    .execSync('docker image ls --format "{{.Repository}}:{{.Tag}}"')
    .toString()
    .split("\n")
}

function snapShotDockerImages() {
  return childProcess
    .execSync('docker image ls --format "{{.ID}}"')
    .toString()
    .split("\n")
}

describe("docker", () => {
  var alreadyPresentDockerImage
  var dockerHandler
  var validDockerImageName = "my-test-org-my-test-image"
  var validDockerRegistry = "validDockerRegistry"
  before(() => {
    process.env.CIRCLECI = "CIRCLECI"
    process.env.CIRCLE_BRANCH = "validBranchName"
    process.env.CIRCLE_PROJECT_USERNAME = "validUser"
    process.env.CIRCLE_PROJECT_REPONAME = "validRepoName"
    process.env.CIRCLE_SHA1 = "1234567890"
    process.env.DOCKER_REGISTRY = validDockerRegistry
    process.env.CIRCLE_TAG = ""
    process.env.CIRCLE_BRANCH = "work/myBranch"
    process.env.DOCKER_USERNAME = "validDockerUserFromEnv"
    process.env.DOCKER_PASSWORD = "validDockerPasswordFromEnv"
    dockerHandler = new Docker(tempDir)
    alreadyPresentDockerImage = snapShotDockerImages()
  })
  after(() => {
    if (fs.existsSync(tempDir)) {
      FileSystemUtils.deleteFolderRecursive(tempDir)
    }
    var currentDockerImages = snapShotDockerImages()

    var imagesToRemove = currentDockerImages
      .filter((image) => !alreadyPresentDockerImage.includes(image))
      .join(" ")

    if (imagesToRemove) {
      childProcess.execSync(`docker rmi -f ${imagesToRemove}`)
    }
  })
  beforeEach(() => {
    recreateGitRepository()
  })

  describe("computeTagsByDockerFilesFromString", () => {
    [
      {
        input: ["valid-image"],
        expectedResult: { Dockerfile: ["valid-image:latest"] },
        description: "Default dockerfile and tag",
      },
      {
        input: ["valid-image", "valid-image2"],
        expectedResult: {
          Dockerfile: ["valid-image:latest", "valid-image2:latest"],
        },
        description: "Multiple images -  default dockerfile and tags",
      },
      {
        input: ["valid-image:valid-tag"],
        expectedResult: { Dockerfile: ["valid-image:valid-tag"] },
        description: "Custom tag",
      },
      {
        input: ["valid-image:valid-tag[dockerfile.valid]"],
        expectedResult: { "dockerfile.valid": ["valid-image:valid-tag"] },
        description: "Custom tag and dockerfile",
      },
      {
        input: ["valid-image[dockerfile.valid]"],
        expectedResult: { "dockerfile.valid": ["valid-image:latest"] },
        description: "Default tag and custom dockerfile",
      },
    ].forEach((testCase) => {
      it(`computes results correctly: ${testCase.description}`, async () => {
        expect(
          await dockerHandler.computeTagsByDockerFilesFromString(testCase.input)
        ).to.deep.equal(testCase.expectedResult)
      })
    })
  })

  describe("computeTagsByDockerFilesFromJson", () => {
    [
      {
        input: { "valid-image": {} },
        expectedResult: { Dockerfile: ["valid-image:latest"] },
        description: "Default dockerfile and tag",
      },
      {
        input: { "valid-image": {}, "valid-image2": {} },
        expectedResult: {
          Dockerfile: ["valid-image:latest", "valid-image2:latest"],
        },
        description: "Multiple images -  default dockerfile and tags",
      },
      {
        input: { "valid-image": { tags: ["valid-tag"] } },
        expectedResult: { Dockerfile: ["valid-image:valid-tag"] },
        description: "Custom tag",
      },
      {
        input: {
          "valid-image": {
            tags: ["valid-tag"],
            dockerFile: "dockerfile.valid",
          },
        },
        expectedResult: { "dockerfile.valid": ["valid-image:valid-tag"] },
        description: "Custom tag and dockerfile",
      },
      {
        input: { "valid-image": { dockerFile: "dockerfile.valid" } },
        expectedResult: { "dockerfile.valid": ["valid-image:latest"] },
        description: "Default tag and custom dockerfile",
      },
    ].forEach((testCase) => {
      it(`computes results correctly: ${testCase.description}`, async () => {
        expect(
          await dockerHandler.computeTagsByDockerFilesFromJson(testCase.input)
        ).to.deep.equal(testCase.expectedResult)
      })
    })
  })

  describe("build", () => {
    it("docker images can be built with image name parameter", async () => {
      await dockerHandler.build({ images: validDockerImageName })
      expect(getDockerImageList()).to.include(`${validDockerImageName}:latest`)
    })

    it("docker images can be built with multiple image name parameter", async () => {
      const customTag = "customTag"
      await dockerHandler.build({
        images: `${validDockerImageName},${validDockerImageName}:${customTag}`,
      })
      expect(getDockerImageList()).to.include(`${validDockerImageName}:latest`)
      expect(getDockerImageList()).to.include(
        `${validDockerImageName}:${customTag}`
      )
    })

    it("default docker image name is used on not setting it as parameter", async () => {
      await dockerHandler.build()
      expect(getDockerImageList()).to.include("validuser-validreponame:latest")
    })
    describe("build - pull", () => {
      var results = []
      var dockerHandler

      beforeEach(() => {
        results = []
        dockerHandler = new Docker(tempDir, (command) => results.push(command))
      })
      it("docker build pulls from image by default", async () => {
        await dockerHandler.build({ images: validDockerImageName })
        expect(results[0]).to.include(`--pull`)
      })

      it("docker build does not pull from image if it is turned off", async () => {
        await dockerHandler.build({
          images: validDockerImageName,
          pull: false,
        })
        expect(results[0]).to.not.include(`--pull`)
      })
    })
  })
  describe("computeDefaultTags", () => {
    it("gives back normalized branch name in build mode", async () => {
      expect(await dockerHandler.computeDefaultTags()).to.include("12345678")
    })
    it("gives back release version in release mode", async () => {
      process.env.CIRCLE_TAG = "release-1.2.3"
      var dockerHandler = new Docker(tempDir, (command) => command)
      process.env.CIRCLE_TAG = ""
      expect(await dockerHandler.computeDefaultTags()).to.include("1.2.3")
    })
  })

  describe("computeDefaultImageName", () => {
    it("computes correct image name", async () => {
      expect(await dockerHandler.computeDefaultImageName()).to.equal(
        "validuser-validreponame"
      )
    })
  })

  describe("login", () => {
    var validUser = "validUser"
    var validPassword = "validPassword"
    it("uses given username and password to authenticate", async () => {
      var dockerHandler = new Docker(tempDir, (command) => command)
      var result = await dockerHandler.login({
        username: validUser,
        password: validPassword,
      })
      expect(result).to.contain(`-u ${validUser} -p ${validPassword}`)
    })

    it("if parameters absent, uses environment defaults", async () => {
      var dockerHandler = new Docker(tempDir, (command) => command)
      var result = await dockerHandler.login()
      expect(result).to.contain(
        `-u validDockerUserFromEnv -p validDockerPasswordFromEnv`
      )
    })
  })

  describe("tag", () => {
    it("tags an image with new tag...", async () => {
      var imageName = "image-to-tag3"
      var newTag = "new-tag"
      await dockerHandler.build({ images: imageName })
      await dockerHandler.tag(`${imageName}:latest`, `${imageName}:${newTag}`)
      expect(getDockerImageList()).to.contain(`${imageName}:${newTag}`)
    })
  })

  describe("push", () => {
    var results = []
    var dockerHandler

    before(() => {
      dockerHandler = new Docker(tempDir, (command) => results.push(command))
      dockerHandler.logger = {
        info: (msg) => {
          results.push(msg)
        },
      }
    })

    beforeEach(() => {
      results = []
    })

    it("pushes the default latest image if parameters are not present", async () => {
      await dockerHandler.push()
      expect(results).to.include(
        `docker push ${validDockerRegistry}/validuser-validreponame:latest`
      )
    })
    it("pushes the specified tag of target image if given", async () => {
      await dockerHandler.push({
        images: JSON.stringify({
          docker: {
            "validuser-validreponame": {
              tags: ["myTag"],
            },
          },
        }),
      })

      expect(results).to.include(
        `docker push ${validDockerRegistry}/validuser-validreponame:myTag`
      )
    })
  })
})
