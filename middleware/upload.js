const multer = require("multer");
const path = require("path");


const storage = multer.diskStorage({

    destination: (req, file, cb) => {
        cb(null, "public/uploads/");
    },

    filename: (req, file, cb) => {

        const fileName =
            Date.now() +
            path.extname(file.originalname);

        cb(null, fileName);
    }

});

const upload = multer({

    storage: storage,

    fileFilter: (req, file, cb) => {

        if (file.mimetype !== "application/pdf") {
            return cb(new Error("Only PDF files are allowed."));
        }

        cb(null, true);
    }

});

module.exports = upload;