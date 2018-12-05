/* eslint-env jest */

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

describe("docker", async () => {
  var alreadyPresentDockerImage
  var dockerHandler
  var validDockerImageName = "my-test-org-my-test-image"
  var validDockerRegistry = "validDockerRegistry"
  beforeAll(() => {
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
    jest.setTimeout(60000)
  })
  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      FileSystemUtils.deleteFolderRecursive(tempDir)
    }
    var currentDockerImages = snapShotDockerImages()
    var imagesToRemove = currentDockerImages
      .filter(image => !alreadyPresentDockerImage.includes(image))
      .join(" ")
    if (imagesToRemove) {
      childProcess.execSync(`docker rmi -f ${imagesToRemove}`)
    }
  })
  beforeEach(() => {
    recreateGitRepository()
  })

  describe("build", () => {
    it("docker images can be built with image name parameter", async () => {
      await dockerHandler.build({ imageName: validDockerImageName })
      expect(getDockerImageList()).to.include(`${validDockerImageName}:latest`)
    })

    it("docker images can be built with multiple image name parameter", async () => {
      const customTag = "customTag"
      await dockerHandler.build({
        imageName: `${validDockerImageName},${validDockerImageName}:${customTag}`
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

    it("docker images can be built with no caching", async () => {
      var dockerHandler = new Docker(tempDir, command => command)
      var result = await dockerHandler.build({
        imageName: null,
        noCache: true
      })
      expect(result).to.contain("--no-cache")
    })
  })
  describe("computeDefaultTags", () => {
    it("gives back normalized branch name in build mode", async () => {
      expect(await dockerHandler.computeDefaultTags()).to.include("12345678")
    })
    it("gives back release version in release mode", async () => {
      process.env.CIRCLE_TAG = "release-1.2.3"
      var dockerHandler = new Docker(tempDir, command => command)
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
      var dockerHandler = new Docker(tempDir, command => command)
      var result = await dockerHandler.login({
        username: validUser,
        password: validPassword
      })
      expect(result).to.contain(`-u ${validUser} -p ${validPassword}`)
    })

    it("if parameters absent, uses environment defaults", async () => {
      var dockerHandler = new Docker(tempDir, command => command)
      var result = await dockerHandler.login()
      expect(result).to.contain(
        `-u validDockerUserFromEnv -p validDockerPasswordFromEnv`
      )
    })
  })

  describe("tag", () => {
    it("tags an image with new tag...", async () => {
      var imageName = "image-to-tag"
      var newTag = "new-tag"
      await dockerHandler.build({ imageName })
      await dockerHandler.tag(imageName, "latest", newTag)
      expect(getDockerImageList()).to.contain(`${imageName}:${newTag}`)
    })
  })
  describe("push", () => {
    var results = []
    var dockerHandler

    beforeAll(() => {
      dockerHandler = new Docker(tempDir, command => results.push(command))
      dockerHandler.logger = {
        info: msg => {
          results.push(msg)
        }
      }
    })

    beforeEach(() => {
      results = []
    })

    it("uses the default values if parameters are not present", async () => {
      await dockerHandler.build()
      await dockerHandler.push()
      expect(results).to.include(
        `docker push ${validDockerRegistry}/validuser-validreponame:12345678`
      )
    })

    it("pushes latest as well if it is set", async () => {
      await dockerHandler.build()
      await dockerHandler.push({
        imageName: validDockerImageName,
        registryUrl: validDockerRegistry,
        latest: true
      })
      expect(results).to.include(
        `docker push ${validDockerRegistry}/${validDockerImageName}:latest`
      )
    })

    it("pushes multiple times on multiple tags", async () => {
      await dockerHandler.build()
      await dockerHandler.push({
        imageName: validDockerImageName,
        registryUrl: validDockerRegistry,
        tags: "a,b",
        latest: true
      })
      expect(results)
        .to.include(
          `docker push ${validDockerRegistry}/${validDockerImageName}:a`
        )
        .and.to.include(
          `docker push ${validDockerRegistry}/${validDockerImageName}:b`
        )
    })
  })
})
