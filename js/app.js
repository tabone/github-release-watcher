'use strict'

;(function () {
  /**
   * The application name.
   * @type {String}
   */
  const APP_NAME = 'GITHUB_RELEASE_WATCHER'

  /**
   * Storage key to cache DB URL.
   * @type {String}
   */
  const STORE_DB_URL = `${APP_NAME}-DB_URL`

  /**
   * Reference to the HTML Element used to display error messages
   * @type {HTML Element}
   */
  const errorDOM = document.querySelector('.app-watcher__error')

  /**
   * Referene to the button used to submit the DB URL.
   * @type {HTML Element}
   */
  const btn = document.querySelector('.app-watcher__submit-btn')

  /**
   * Reference to the Input Field used to get the DB URL.
   * @type {HTML Element}
   */
  const dbURLField = document.querySelector('.app-watcher__db')

  /**
   * Reference to the HTML Element which will display any new updates.
   * @type {HTML Element}
   */
  const table = document.querySelector('.app-watcher__table-updates')

  // Add a listener to the submit button so that when it is clicked it starts
  // the checking.
  btn.addEventListener('click', run)

  // Check whether the user has a cached DB URL and if so, use it.
  chrome.storage.sync.get(STORE_DB_URL, info => {
    const dbURL = info[STORE_DB_URL]
    if (dbURL === undefined) return
    dbURLField.value = dbURL
    run()
  })

  /**
   * Function used to check whether there are any updates to the repos inside
   * the provided DB URL.
   * @return {Promise}  Resolved on successful check, rejected otherwise.
   */
  function run () {
    // Get the DB URL entered.
    const dbURL = dbURLField.value
    
    // If no DB URL is provided, do nothing.
    if (dbURL.length === 0) return

    // Cache DB URL.
    chrome.storage.sync.set({ [STORE_DB_URL]: dbURL })

    // Retrieve DB JSON file.
    return doRequest(dbURLField.value).then(xhr => {
      const entries = JSON.parse(xhr.responseText)
      const promises = []

      // Retrieve the latest release for each repo.
      entries.forEach(entry => {
        promises.push(retrieveLatestRelease(entry))
      })

      return Promise.all(promises)
    }).then(repos => {
      // Finally if releases version does not match, display the update in the
      // DOM.
      repos.forEach(({ entry, release }) => {
        if (entry.version !== release.name) addUpdate({ entry, release})
      })

      displayError('')
    }).catch(err => {
      if (err.entity === APP_NAME) return displayError(err.message)
      displayError('An error had occured.')
    })
  }

  /**
   * Function used to retrieve the latest release info of a repo.
   * @param  {String} entry.user        The repo's owner name.
   * @param  {String} entry.repository  The repo's name.
   * @return {Promise}  Resolved with the release & entry details, rejected
   *                    otherwise.
   */
  function retrieveLatestRelease (entry) {
    const url = `https://api.github.com/repos/${entry.user}/` +
      `${entry.repository}/releases/latest`
    return doRequest(url).then(xhr => {
      return {
        entry: entry,
        release: JSON.parse(xhr.responseText)
      }
    })
  }

  /**
   * Function used to display an update.
   * @param {Object} options.entry    DB Entry info.
   * @param {Object} options.release  Github Release info.
   */
  function addUpdate ({entry, release}) {
    const row = document.createElement('tr')
    const repoName = document.createElement('td')
    const repoVersion = document.createElement('td')
    const repoLatest = document.createElement('td')
    const repoLink = document.createElement('a')

    repoName.innerHTML = `${entry.user}/${entry.repository}`
    repoVersion.innerHTML = entry.version

    repoLink.href = "javascript:;"
    repoLink.innerHTML = release.name
    repoLink.title = `${repoName.innerHTML} release page`
    repoLink.addEventListener('click', function () {
      openURL(release['html_url'])
    })

    repoLatest.appendChild(repoLink)

    row.appendChild(repoName)
    row.appendChild(repoVersion)
    row.appendChild(repoLatest)

    table.innerHTML = ''
    table.appendChild(row)
  }

  /**
   * Function used to make an async HTTP GET Request.
   * @param  {String} url  The URL of the Request.
   * @return {Promise}     Resolved once on successful request, rejected
   *                       otherwise.
   */
  function doRequest (url) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      xhr.open('GET', url)
      xhr.addEventListener('load', function () {
        if (this.status !== 200) {
          return reject({
            entity: APP_NAME,
            message: 'DB URL not reachable'
          })
        }
        resolve(this)
      })
      xhr.addEventListener('abort', function () { reject(this) })
      xhr.addEventListener('error', function () { reject(this) })

      xhr.send()
    })
  }

  /**
   * Function used to open a page.
   * @param  {String} url  The URL to open.
   */
  function openURL (url) {
    chrome.tabs.create({ active: true, url: url })
  }

  /**
   * Function used to display an error message.
   * @param  {String} message  Error message to be displayed
   */
  function displayError (message) {
    if (message.length === 0) return errorDOM.classList.add('app-watcher--hide')
    errorDOM.classList.remove('app-watcher--hide')
    errorDOM.innerHTML = message
  }
}())
