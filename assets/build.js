const fs = require('node:fs');

function searchDirectory(dir, type) {
    let matches = [];
    let recurse = (d) => {
        // read the contents of the directory
        const files = fs.readdirSync(d);

        // search through the files
        for (const file of files) {
            // build the full path of the file
            const filePath = d + "/" + file;

            // get the file stats
            const fileStat = fs.statSync(filePath);

            // if the file is a directory, recursively search the directory
            if (fileStat.isDirectory()) {
                recurse(filePath, file);
            } else if (file.match(type)) {
                // if the file is a match, print it
                matches.push(file);
            }
        }
    }
    recurse(dir);
    return matches;
}


async function makeIconLibrary() {
    let regex = /i_(\w+).svg/;
    let icons = searchDirectory("./", regex);
    let iconLibrary = {}
    try {
      for (let icon of icons) {
        console.log(icon);
          const data = await fs.readFileSync(icon, 'utf8');
          const name = icon.match(regex)[1];
          iconLibrary[name] = data;
      }
      
      fs.writeFile('./icon-library.js', `export const IconLibrary = ${JSON.stringify(iconLibrary, null, "\n")}`, err => {
        if (err) {
          console.error(err);
        }
        // file written successfully
      });
    } catch (err) {
      console.log(err);
    }
  }

makeIconLibrary()