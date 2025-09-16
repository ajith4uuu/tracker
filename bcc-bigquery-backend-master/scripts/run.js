import { bigQueryBackend } from "../index.js";

// To deploy the express app locally for dev & test purposes
bigQueryBackend.listen(process.env.PORT, () => {
    console.log('BCC backend initiated.');
});
