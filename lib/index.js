const defaults = require('lodash.defaults')
const Hoek = require('hoek')
const omit = require('lodash.omit')
const path = require('path')
const webpack = require('webpack')
const WebpackDevMiddleware = require('webpack-dev-middleware')
const WebpackHotMiddleware = require('webpack-hot-middleware')

exports.register = function (server, options, next) {
  const webpackOptions = omit(options, 'devServer', 'hotServer')

  const publicPath = webpackOptions.output.publicPath
  const compiler = webpack(webpackOptions, (err, stats) => {
    Hoek.assert(!err, err)

    const jsonStats = stats.toJson()
    server.expose('stats', jsonStats)
    server.expose('compiler', compiler)

    if (!options.isDev) {
      const paths = jsonStats.assets.map((asset) => {
        const endpoint = path.resolve(publicPath, asset.name)
        server.route({
          handler: {
            file: path.resolve(options.output.path, asset.name)
          },
          method: 'GET',
          path: endpoint
        })
        return endpoint
      })
      server.expose('paths', paths)
    }

    return next()
  })

  if (options.isDev) {
    const devOptions = defaults(options.devServer, {
      noInfo: true,
      hot: true
    })

    const hotOptions = defaults(options.hotServer, {
      publicPath
    })
    const webpackDevMiddleware = WebpackDevMiddleware(compiler, devOptions)
    const webpackHotMiddleware = WebpackHotMiddleware(compiler, hotOptions)

    server.ext('onRequest', (request, reply) => {
      const req = request.raw.req
      const res = request.raw.res
      webpackDevMiddleware(req, res, (err) => {
        if (err) {
          return reply(err)
        }
        reply.continue()
      })
    })

    server.ext('onRequest', (request, reply) => {
      const req = request.raw.req
      const res = request.raw.res
      webpackHotMiddleware(req, res, (err) => {
        if (err) {
          return reply(err)
        }
        reply.continue()
      })
    })
  }
}

exports.register.attributes = {
  pkg: require('../package.json')
}
