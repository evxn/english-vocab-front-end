# Front-End Test Assignment

Let's develop the client-side of a training app for practicing and memorizing English words.

Here's how the result should look like:

[Screen Recording 2023-03-21 at 14.35.40.mov](./Screen%20Recording%202023-03-21%20at%2014.35.40.mov)

## Markup

Use the **[ready-made markup](https://gist.github.com/anton-isaykin/6018c5e125ecf8b66ac89634d839960d)** for the application. Modify the layout if necessary.

## Business Logic

- A set of words for training is hardcoded into the application.

    ```json
    [
      "apple",
      "function",
      "timeout",
      "task",
      "application",
      "data",
      "tragedy",
      "sun",
      "symbol",
      "button",
      "software"
    ]
    ```

- Each training session contains 6 random words from the list and represents a sequential set of tasks.
- In each task, the user receives a word broken into letters, shuffled in a random order.
- The user's task is to assemble the entire word by moving the letters from one container to another.
- The user can click on letter buttons or press corresponding keys on the keyboard.
- If the user selects an incorrect letter, the application marks it as an error and highlights the respective button in red.
- When typing on the keyboard, error highlighting only occurs if the letter is present in the word. If it's absent, the application acknowledges the error without indication.
- If the user presses a key for a missing letter, the application registers it as an error.
- The maximum number of errors in one task is 3. Upon reaching this limit, all buttons arrange correctly but change color to red. After a slight delay, it moves to the next task.
- Upon completing the training, the application provides statistics:
    - Number of words assembled without errors.
    - Number of errors.
    - Word with the highest number of errors.
- There is no predefined UI for displaying statistics; represent the data in any convenient way.

## Bonus Track

Fulfill additional requirements if the task seems too easy.

- If the user closes tabs or refreshes the page before completing the task, the application, upon revisiting the page, should offer to continue the previously started training. If the user agrees, the application restores itself to the same state as at the time of tab closure or page refresh.
- The application responds to browser history navigation button clicks and allows moving between completed tasks.

# Technical Requirements

- All code should be written in TypeScript.
- Set up the project build independently: Webpack 5, Babel, TS, and dev server.
- In the dev build, serve the HTML application page using Webpack Dev Server and hot module replacement.
- Separate business logic and presentation logic so that it's possible to seamlessly replace the UI layer - for instance, use Canvas instead of DOM.
- Avoid using frameworks and ready-made libraries. All DOM interactions should be done using standard means.
- Do not use Flux or similar patterns for organizing application data and logic.
- All code should reside in a single repository.
- Attach a `README` file describing the build process and how to run the application.
- Format the code using [prettier](https://prettier.io/) with the default config.
- Along with the repository link, provide a brief overview of the challenges encountered during the test and the time spent.

# How We Evaluate the Test

We thoroughly review the test. Two developers from our team perform a code review and make a decision. Ultimately, it boils down to these simple criteria:

- [ ] The code is simple and easy to read.
- [ ] All requirements from the specification are fulfilled.
- [ ] No bugs.

# Install Dev Dependencies

```sh
$ npm install
```

# Dev Build

```sh
$ npm run dev-build
```

Built artifacts will be in the `dist` directory.

# Start Development Server with Hot Reloading

```sh
$ npm run start
```

# Formatter

```sh
$ npm run format
```

