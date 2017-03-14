const Joi = require('joi')
const omit = require('lodash.omit')
const path = require('path')
const pkg = require('../package.json')
const webpack = require('webpack')

const joi = {
  schema: Joi.object({
    outuput: {
      path: Joi.string().required(),
      publicPath: Joi.string().default('/').optional()
    }
  }),
  options: {
    abortEarly: false,
    allowUnknown: true
  }
}

exports.register = function register (server, options, next) {
  const webpackOptions = omit(options, 'devServer', 'hotServer')

  const {
    error,
    value
  } = Joi.validate(options, joi.schema, joi.options)

  if (error) {
    return next(new Error(error))
  }

  const rootPath = value.output.path
  const publicPath = value.output.publicPath

  const compiler = webpack(webpackOptions, (err, stats) => {
    if (err) {
      return next(err)
    }

    const jsonStats = stats.toJson()
    server.expose('stats', jsonStats)
    server.expose('compiler', compiler)

    if (!options.isDev) {
      const paths = jsonStats.assets.map(asset => {
        return path.join(publicPath, asset.name)
      })

      server.expose('paths', paths)

      server.route({
        handler: {
          directory: {
            path: rootPath
          }
        },
        method: 'get',
        path: path.join(publicPath, '{path*}')
      })
    }

    return next()
  })

  if (options.isDev) {
    const webpackDevMiddleware = require('webpack-dev-middleware')
    const webpackHotMiddleware = require('webpack-hot-middleware')

    const devOptions = Object.assign(
      {
        noInfo: true,
        hot: true
      },
      options.devServer
    )

    const webpackDev = webpackDevMiddleware(compiler, devOptions)
    server.ext('onRequest', (request, reply) => {
      const req = request.raw.req
      const res = request.raw.res

      webpackDev(req, res, err => {
        if (err) {
          return reply(err)
        }

        return reply.continue()
      })
    })

    const hotOptions = Object.assign(
      {
        publicPath
      },
      options.hotServer
    )

    const webpackHot = webpackHotMiddleware(compiler, hotOptions)
    server.ext('onRequest', (request, reply) => {
      const req = request.raw.req
      const res = request.raw.res

      webpackHot(req, res, err => {
        if (err) {
          return reply(err)
        }

        return reply.continue()
      })
    })
  }
}

exports.register.attributes = {
  name: 'web-planr',
  version: pkg.version,
  dependencies: 'inert'
}
