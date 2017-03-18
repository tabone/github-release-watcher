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
   * Reference to the HTML Element used to display announcements.
   * @type {HTML Element}
   */
  const announceDOM = document.querySelector('.app-watcher__announce')

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
   * Reference to the table HTML Element.
   * @type {HTML Element}
   */
  const table = document.querySelector('.app-watcher__table')

  /**
   * Reference to the HTML Element which will display any new updates.
   * @type {HTML Element}
   */
  const tableBody = document.querySelector('.app-watcher__table-updates')

  /**
   * Contains info about the different announcement types.
   * @type {Object}
   */
  const announceTypes = {
    INFO: 0,
    ERROR: 1
  }

  // Add a listener to the submit button so that when it is clicked it starts
  // the checking.
  btn.addEventListener('click', run)

  announce('Checking for cached DB URL')

  // Check whether the user has a cached DB URL and if so, use it.
  chrome.storage.sync.get(STORE_DB_URL, info => {
    const dbURL = info[STORE_DB_URL]
    if (dbURL === undefined) return toggleVisibility(announceDOM, false)
    dbURLField.value = dbURL
    run()
  })

  /**
   * Function used to check whether there are any updates to the repos inside
   * the provided DB URL.
   * @return {Promise}  Resolved on successful check, rejected otherwise.
   */
  function run () {
    // Hide table.
    toggleVisibility(table, false)

    // Get the DB URL entered.
    const dbURL = dbURLField.value
    
    // If no DB URL is provided, do nothing.
    if (dbURL.length === 0) return

    announce('Caching DB URL...')

    // Cache DB URL.
    chrome.storage.sync.set({ [STORE_DB_URL]: dbURL })

    announce('Retrieving JSON DB File...')
    // Retrieve DB JSON file.
    return retrieveDBFile(dbURLField.value).then(xhr => {
      announce('JSON DB File retrieved!')

      const entries = JSON.parse(xhr.responseText)
      const promises = []

      announce('Retrieving Repos Info...')
      // Retrieve the latest release for each repo.
      entries.forEach(entry => {
        promises.push(retrieveLatestRelease(entry))
      })

      return Promise.all(promises)
    }).then(repos => {
      announce('Checking Repos...')

      // Clear table
      tableBody.innerHTML = ''

      // Finally if releases version does not match, display the update in the
      // DOM.
      repos.forEach(({ entry, release }) => {
        if (entry.version !== release.name) addUpdate({ entry, release})
      })

      announce(table.classList.contains('app-watcher--hide')
        ? 'Repos are up-to-date!'
        : 'Done :)')
    }).catch(err => {
      const annouceError = announceTypes.ERROR
      if (err.entity === APP_NAME) return announce(err.message, annouceError)
      announce('An error had occured.', annouceError)
    })
  }

  /**
   * Function used to retrieve the DB JSON File.
   * @param  {String} url The URL of the DB JSON File.
   * @return {Promise}  Resolved on retrieval of DB JSON File, rejected
   *                    otherwise.
   */
  function retrieveDBFile (url) {
    return doRequest(url).catch(xhr => {
      if (xhr.status === 404) {
        return Promise.reject({
          entity: APP_NAME,
          message: 'DB URL unreachable'
        })
      }
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

    tableBody.appendChild(row)
    toggleVisibility(table, true)
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
        if (this.status !== 200) return reject(this)
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
   * Function used to announce something to the user.
   * @param  {String} message  Message to be displayed
   * @param  {String} type     Announcement type.
   */
  function announce (message, type) {
    switch (type) {
      case announceTypes.ERROR: {
        announceDOM.classList.remove('app-watcher__announce--info')
        announceDOM.classList.add('app-watcher__announce--error')
        break
      }
      default: {
        announceDOM.classList.remove('app-watcher__announce--error')
        announceDOM.classList.add('app-watcher__announce--info')
      }
    }

    // Set the message.
    announceDOM.innerHTML = message

    // Display announce HTML Element.
    toggleVisibility(announceDOM, true)
  }

  /**
   * Function used to toggle the visibility of an HTML Element.
   * @param  {HTML Element} elem  HTML Element to be shown/hidden.
   * @param  {Boolean}      show  Indicates whether to show or hide the element.
   */
  function toggleVisibility (elem, show) {
    if (show === true) return elem.classList.remove('app-watcher--hide')
    elem.classList.add('app-watcher--hide')
  }
}())
