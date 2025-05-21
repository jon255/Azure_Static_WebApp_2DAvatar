function sendMessage() {
  const inputElement = document.getElementById("userInput");
  const messageText = inputElement.value.trim();

  if (messageText === "") {
    return;
  }

  // Display user's message
  appendMessage(messageText, "user");

  // Clear the input field
  inputElement.value = "";

  // Simulate response from the avatar
  setTimeout(() => {
    appendMessage("Hello! How can I assist you today?", "avatar");
  }, 1000);
}

function appendMessage(text, sender) {
  const chatBox = document.getElementById("chatBox");

  const messageDiv = document.createElement("div");
  messageDiv.classList.add("message");
  if (sender === "user") {
    messageDiv.classList.add("user-message");
  }

  const avatarDiv = document.createElement("div");
  avatarDiv.classList.add("avatar");

  const textDiv = document.createElement("div");
  textDiv.classList.add("text");
  textDiv.textContent = text;

  messageDiv.appendChild(avatarDiv);
  messageDiv.appendChild(textDiv);

  chatBox.appendChild(messageDiv);

  // Scroll to the bottom to show the latest message
  chatBox.scrollTop = chatBox.scrollHeight;
}
