import { type RouteConfig, route, index } from "@react-router/dev/routes";

export default [

    // Use `base-page-layout.tsx` as the base layout for all the pages
    route("/", "./components/ui/base-page-layout.tsx", [
        // index("./views/temp-landing-page.tsx"),
        index("./views/welcome-page/welcome-page.tsx"),

        route('/survey', './views/questions-list-page.tsx'),
        // index("./views/temp-survey.tsx"),
        // index("./views/questions-list-page.tsx"),
        // index("./views/login-page.tsx"),
    ])

] satisfies RouteConfig;
