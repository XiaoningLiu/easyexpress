import * as rimraf from "rimraf";
import * as SwaggerParser from "json-schema-ref-parser";
import Project from "ts-simple-ast";

const GENERATED_DIST = "generated";

async function rmdir(dir: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    rimraf(dir, err => {
      err ? reject(err) : resolve();
    });
  });
}

function typeSerilize(type: string): string {
  switch (type) {
    case "integer":
      return "number";
    default:
      return type;
  }
}

async function main() {
  const project = new Project();
  project.createDirectory(GENERATED_DIST);
  await rmdir(GENERATED_DIST);

  const parser = new SwaggerParser();
  const apis = await parser.dereference("./blob-storage-2018-03-28.json");
  // console.log(apis);

  const middlewareFile = project.createSourceFile(
    `${GENERATED_DIST}/middlewares.ts`
  );

  middlewareFile.addImportDeclaration({
    defaultImport: "* as express",
    moduleSpecifier: "express"
  });

  middlewareFile.addFunction({
    name: "deserialize",
    parameters: [{ name: "req" }, { name: "res" }],
    returnType: "any",
    docs: [
      "Manually implemented and will deserialize express request into TypeScript models"
    ]
  });
  middlewareFile.addFunction({
    name: "serialize",
    docs: [
      "Manually implemented and will serialize TypeScript response models into express results"
    ]
  });
  middlewareFile.addFunction({
    name: "errorSerialize",
    docs: [
      "Manually implemented and will serialize TypeScript response errors into express results"
    ]
  });

  const operationEnumMembers = [];
  const blobManagerMethods = [];
  const dispatchMiddlewareBodys = [];
  for (const path in apis["x-ms-paths"]) {
    for (const method in apis["x-ms-paths"][path]) {
      if (
        method === "get" ||
        method === "put" ||
        method === "post" ||
        method === "delete" ||
        method === "head"
      ) {
        const operationId: string | undefined =
          apis["x-ms-paths"][path][method].operationId;
        if (operationId) {
          operationEnumMembers.push({
            name: operationId
          });
          const querySelectors = [];

          const parameters = apis["x-ms-paths"][path].parameters || [];
          for (const param of parameters) {
            querySelectors.push(
              `req.query["${param.name}"] === "${param.enum[0]}"`
            );
          }

          dispatchMiddlewareBodys.push(`\
if (req.method.toUpperCase() === "${method.toUpperCase()}" ${
            querySelectors.length > 0 ? " && " : ""
          } ${querySelectors.join(" && ")}) {
  const ctx = res.locals.context as Context;
  ctx.operation = Operation.${operationId};
  next();
  return;
}\
          `);
        }
      }
    }
  }
  middlewareFile.addEnum({ name: "Operation", members: operationEnumMembers });

  middlewareFile.addInterface({
    name: "Context",
    properties: [
      { name: "operation", hasQuestionToken: true, type: "Operation" }
    ]
  });

  middlewareFile.addFunction({
    name: "dispatchMiddleware",
    docs: ["Auto generated express middlewares"],
    parameters: [
      {
        name: "req",
        type: "express.Request"
      },
      {
        name: "res",
        type: "express.Response"
      },
      {
        name: "next",
        type: "express.NextFunction"
      }
    ],
    bodyText: dispatchMiddlewareBodys.join("\n"),
    returnType: "express.RequestHandler"
  });

  for (const path in apis["x-ms-paths"]) {
    for (const method in apis["x-ms-paths"][path]) {
      if (
        method === "get" ||
        method === "put" ||
        method === "post" ||
        method === "delete" ||
        method === "head"
      ) {
        const operationId: string | undefined =
          apis["x-ms-paths"][path][method].operationId;
        if (operationId) {
          const protocolMethodName = operationId.split("_").join("");
          const middlewareMethodName = operationId
            .split("_")
            .concat("Middleware")
            .join("");
          blobManagerMethods.push({
            name: protocolMethodName,
            parameters: [
              {
                name: "request",
                type: `${protocolMethodName}Request`
              }
            ],
            returnType: `Promise<${protocolMethodName}Response>`
          });

          const requestModelProperties = [];
          if (apis["x-ms-paths"][path][method].parameters) {
            for (const key in apis["x-ms-paths"][path][method].parameters) {
              if (
                apis["x-ms-paths"][path][method].parameters.hasOwnProperty(key)
              ) {
                const element =
                  apis["x-ms-paths"][path][method].parameters[key];
                requestModelProperties.push({
                  name: (element["x-ms-client-name"] || element.name)
                    .split("-")
                    .join(""),
                  hasQuestionToken: !element.required,
                  type: typeSerilize(element.type)
                });
              }
            }
          }

          middlewareFile.addInterface({
            name: `${protocolMethodName}Request`,
            properties: requestModelProperties
          });

          const responseModelProperties = [];
          if (apis["x-ms-paths"][path][method].responses["200"]) {
            for (const key in apis["x-ms-paths"][path][method].responses["200"]
              .headers) {
              if (
                apis["x-ms-paths"][path][method].responses[
                  "200"
                ].headers.hasOwnProperty(key)
              ) {
                const element =
                  apis["x-ms-paths"][path][method].responses["200"].headers[
                    key
                  ];
                responseModelProperties.push({
                  name: (element["x-ms-client-name"] || key)
                    .split("-")
                    .join(""),
                  type: typeSerilize(element.type)
                });
              }
            }
          }

          if (apis["x-ms-paths"][path][method].responses["202"]) {
            for (const key in apis["x-ms-paths"][path][method].responses["202"]
              .headers) {
              if (
                apis["x-ms-paths"][path][method].responses[
                  "202"
                ].headers.hasOwnProperty(key)
              ) {
                const element =
                  apis["x-ms-paths"][path][method].responses["202"].headers[
                    key
                  ];
                responseModelProperties.push({
                  name: (element["x-ms-client-name"] || key)
                    .split("-")
                    .join(""),
                  type: typeSerilize(element.type)
                });
              }
            }
          }

          middlewareFile.addInterface({
            name: `${protocolMethodName}Response`,
            properties: responseModelProperties
          });

          middlewareFile.addFunction({
            name: middlewareMethodName,
            docs: ["Auto generated express middlewares"],
            parameters: [
              {
                name: "req",
                type: "express.Request"
              },
              {
                name: "res",
                type: "express.Response"
              },
              {
                name: "next",
                type: "express.NextFunction"
              }
            ],
            bodyText: `const ctx = res.locals.context as Context;
if (ctx.operation && ctx.operation === Operation.${operationId}) {
  const requestModel: ${protocolMethodName}Request = deserialize(req, res);
  blobStorageManager
  .${protocolMethodName}(requestModel)
  .then(serialize)
  .catch(errorSerialize);
}
next();
`,
            returnType: "express.RequestHandler"
          });
        }
      }
    }
  }

  middlewareFile.addInterface({
    name: "BlobStorageManager",
    methods: blobManagerMethods,
    docs: ["This is the protocol layer interface"]
  });

  await project.save();
}

main();
