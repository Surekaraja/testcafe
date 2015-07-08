import Promise from 'promise';
import browserInstallations from '../browser/installations';
import reporters from '../reporters';
import BrowserConnection from '../browser/connection';
import LocalBrowserConnection from '../browser/local-connection';
import { MESSAGES, getText } from '../messages';


export default class Bootstrapper {
    static BROWSER_CONNECTION_READY_TIMEOUT = 30 * 1000;

    constructor (browserConnectionGateway) {
        this.browserConnectionGateway = browserConnectionGateway;

        this.src             = [];
        this.browsers        = [];
        this.filter          = null;
        this.reportOutStream = null;
        this.reporter        = null;
    }

    static _createBrowserConnectionReadyPromises (browserConnections) {
        return browserConnections
            .filter(bc => !bc.ready)
            .map(bc => new Promise(resolve => bc.once('ready', resolve)));
    }

    static _waitBrowserConnectionsReady (browserConnections) {
        return new Promise((resolve, reject) => {
            var timeout = setTimeout(() => {
                reject(new Error(getText(MESSAGES.cantEstablishBrowserConnection)));
            }, Bootstrapper.BROWSER_CONNECTION_READY_TIMEOUT);

            var onError = msg => {
                reject(new Error(msg));
            };

            browserConnections.forEach(bc => bc.once('error', onError));

            var ready = Bootstrapper._createBrowserConnectionReadyPromises(browserConnections);

            Promise.all(ready).then(() => {
                browserConnections.forEach(bc => bc.removeListener('error', onError));
                clearTimeout(timeout);
                resolve();
            });
        });
    }

    static _convertBrowserAliasToBrowserInfo (browser) {
        if (typeof browser !== 'string')
            return browser;

        var browserInfo = browserInstallations.getInfo(browser);

        if (!browserInfo)
            throw new Error(getText(MESSAGES.cantFindBrowserForAlias, browser));

        return browserInfo;
    }

    _createConnectionFromBrowserInfo (browser) {
        if (browser instanceof BrowserConnection)
            return browser;

        return new LocalBrowserConnection(this.browserConnectionGateway, browser);
    }

    async _getBrowserConnections () {
        if (!this.browsers.length)
            throw new Error(getText(MESSAGES.browserNotSet));

        var browserConnections = this.browsers
            .map(Bootstrapper._convertBrowserAliasToBrowserInfo)
            .map(browser => this._createConnectionFromBrowserInfo(browser));

        await Bootstrapper._waitBrowserConnectionsReady(browserConnections);

        return browserConnections;
    }

    async _getTests () {
        //TODO
    }

    _createReporter () {
        var Reporter = this.reporter;

        if (!Reporter)
            throw new Error(getText(MESSAGES.reporterNotSet));

        if (typeof Reporter === 'string') {
            Reporter = reporters[Reporter];

            if (!Reporter)
                throw new Error(getText(MESSAGES.unknownReporter, this.reporter));
        }

        return new Reporter(this.reportOutStream);
    }


    // API
    async createRunnableConfiguration () {
        var reporter = this._createReporter();

        var [browserConnections, tests] = await * [
            this._getBrowserConnections(),
            this._getTests()
        ];

        return { reporter, browserConnections, tests };
    }
}